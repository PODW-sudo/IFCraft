import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  ProjectMetadata,
  SpatialNode,
  ElementDetails
} from '../types/ifc';
import type {
  CollaborationClient,
  Collaborator,
  ElementLock
} from '../services/collaboration';
import * as api from '../services/api';
import { ElementDetailsLoader } from '../services/elementDetailsLoader';

export interface UseSpatialSelectionOptions {
  currentProject: ProjectMetadata | null;
  spatialTree: SpatialNode | null;
  collaborators: Collaborator[];
  elementLocks: Record<number, ElementLock>;
  collabClientRef: React.RefObject<CollaborationClient | null>;
  onLockNotification?: (notif: { expressID: number; userName: string; userColor?: string }) => void;
  onElementSelected?: (expressId: number | null) => void;
  /**
   * Optional shared details loader. Pass one instance from the app shell so the
   * selection effect and any post-save reload share the same ordering (STEP-14).
   */
  elementDetailsLoader?: ElementDetailsLoader;
}

export function useSpatialSelection({
  currentProject,
  spatialTree,
  collaborators,
  elementLocks,
  collabClientRef,
  onLockNotification,
  onElementSelected,
  elementDetailsLoader
}: UseSpatialSelectionOptions) {
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null);
  const [isolatedExpressID, setIsolatedExpressID] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [pinnedExpressIds, setPinnedExpressIds] = useState<Set<number>>(new Set());
  const pinnedExpressIdsRef = useRef<Set<number>>(pinnedExpressIds);
  pinnedExpressIdsRef.current = pinnedExpressIds;

  const [selectedElementDetails, setSelectedElementDetails] = useState<ElementDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState<{
    expressId: number;
    timestamp: number;
  } | null>(null);

  // One loader per hook (or the caller's shared one). The sequence guard inside it is
  // what prevents a slow response for A from overwriting B's panel.
  const internalLoaderRef = useRef<ElementDetailsLoader | null>(null);
  if (internalLoaderRef.current === null) {
    internalLoaderRef.current = new ElementDetailsLoader((projectId, expressId) =>
      api.getElementDetails(projectId, expressId)
    );
  }
  const loader = elementDetailsLoader ?? internalLoaderRef.current;

  const applyDetailsResult = useCallback(
    (expressId: number | null, result: { details: ElementDetails | null; error: string | null }) => {
      setSelectedElementDetails(result.details);
      setDetailsError(result.error);
      if (result.error) {
        console.warn(`Could not load element details for #${expressId}:`, result.error);
      }
    },
    []
  );

  /**
   * Re-fetches one element's details through the shared loader and applies the result
   * only when it is still current. Exposed so a property save can refresh the panel
   * (`onPropertyUpdated`).
   */
  const reloadElementDetails = useCallback(
    async (expressId: number): Promise<ElementDetails | null> => {
      if (!currentProject) return null;
      setIsDetailsLoading(true);
      const result = await loader.select(currentProject.id, expressId);
      if (result.superseded) return result.details;
      setIsDetailsLoading(false);
      applyDetailsResult(expressId, result);
      return result.details;
    },
    [currentProject, loader, applyDetailsResult]
  );

  /** Reloads whatever is selected now; convenience for `onPropertyUpdated`. */
  const reloadSelectedElementDetails = useCallback(async (): Promise<ElementDetails | null> => {
    if (selectedExpressID === null) return null;
    return reloadElementDetails(selectedExpressID);
  }, [reloadElementDetails, selectedExpressID]);

  // Sync Element Details on Project or Selected ID change
  useEffect(() => {
    if (
      !currentProject ||
      selectedExpressID === null ||
      typeof selectedExpressID !== 'number' ||
      !Number.isInteger(selectedExpressID) ||
      selectedExpressID <= 0
    ) {
      setSelectedElementDetails(null);
      setDetailsError(null);
      setIsDetailsLoading(false);
      // Supersede any in-flight request so it cannot repopulate a cleared panel.
      void loader.select(null, null);
      return;
    }

    let isMounted = true;
    setIsDetailsLoading(true);
    setDetailsError(null);
    void loader.select(currentProject.id, selectedExpressID).then((result) => {
      // `isMounted` covers unmount only; `superseded` is the ordering guard.
      if (!isMounted || result.superseded) return;
      setIsDetailsLoading(false);
      applyDetailsResult(selectedExpressID, result);
    });

    return () => {
      isMounted = false;
    };
  }, [currentProject, selectedExpressID, loader, applyDetailsResult]);

  // Extract Storeys from Spatial Tree
  const storeys = useMemo(() => {
    if (!spatialTree) return [];
    const list: { id: number; name: string; elevation: number }[] = [];
    const traverse = (node: SpatialNode) => {
      if (node.type === 'IfcBuildingStorey') {
        list.push({ id: node.express_id, name: node.name, elevation: node.elevation ?? 0 });
      }
      node.children?.forEach(traverse);
    };
    traverse(spatialTree);
    return list;
  }, [spatialTree]);

  // Handle Element Selection with Soft Locking
  const handleSelectElement = useCallback(
    (expressID: number | null) => {
      // Release previous selection lock if held
      if (selectedExpressID !== null && collabClientRef.current) {
        collabClientRef.current.deselectElement(selectedExpressID);
      }

      if (expressID !== null) {
        // Check if locked by another user (NOT ourselves, and only if other user is actively connected)
        const existingLock = elementLocks[expressID];
        const myUserId = collabClientRef.current?.profile.userId || localStorage.getItem('ifc_editor_user_id');

        if (existingLock && existingLock.user_id !== myUserId) {
          const isHolderConnected = collaborators.some((u) => u.user_id === existingLock.user_id);
          if (isHolderConnected) {
            onLockNotification?.({
              expressID,
              userName: existingLock.user_name || 'another user',
              userColor: existingLock.user_color
            });
            return;
          }
        }

        setSelectedExpressID(expressID);
        // Acquire lock via WebSocket
        collabClientRef.current?.selectElement(expressID);
      } else {
        setSelectedExpressID(null);
      }
      onElementSelected?.(expressID);
    },
    [selectedExpressID, elementLocks, collaborators, collabClientRef, onLockNotification, onElementSelected]
  );

  const handleTogglePin = useCallback(
    async (expressId: number) => {
      if (!currentProject) return;
      const isCurrentlyPinned = pinnedExpressIdsRef.current.has(expressId);
      try {
        await api.pinElement(currentProject.id, expressId, { is_pinned: !isCurrentlyPinned });
        const next = new Set(pinnedExpressIdsRef.current);
        if (isCurrentlyPinned) {
          next.delete(expressId);
        } else {
          next.add(expressId);
        }
        pinnedExpressIdsRef.current = next;
        setPinnedExpressIds(next);
        if (selectedExpressID === expressId) {
          // Refresh through the shared loader so a pin cannot resurrect a stale panel.
          const result = await loader.select(currentProject.id, expressId);
          if (result.superseded) return;
          applyDetailsResult(expressId, result);
        }
      } catch (err) {
        console.error('Failed to toggle pin status:', err);
      }
    },
    [currentProject, selectedExpressID, loader, applyDetailsResult]
  );

  const toggleCategoryVisibility = useCallback((category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const triggerFocus = useCallback((expressId: number) => {
    setFocusTrigger({ expressId, timestamp: Date.now() });
  }, []);

  return {
    selectedExpressID,
    setSelectedExpressID,
    isolatedExpressID,
    setIsolatedExpressID,
    hiddenCategories,
    setHiddenCategories,
    toggleCategoryVisibility,
    pinnedExpressIds,
    setPinnedExpressIds,
    pinnedExpressIdsRef,
    selectedElementDetails,
    setSelectedElementDetails,
    detailsError,
    isDetailsLoading,
    /** Shared details loader; pass the same instance to anything that re-fetches details. */
    elementDetailsLoader: loader,
    reloadElementDetails,
    reloadSelectedElementDetails,
    storeys,
    focusTrigger,
    setFocusTrigger,
    triggerFocus,
    handleSelectElement,
    handleTogglePin
  };
}

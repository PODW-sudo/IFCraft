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

export interface UseSpatialSelectionOptions {
  currentProject: ProjectMetadata | null;
  spatialTree: SpatialNode | null;
  collaborators: Collaborator[];
  elementLocks: Record<number, ElementLock>;
  collabClientRef: React.RefObject<CollaborationClient | null>;
  onLockNotification?: (notif: { expressID: number; userName: string; userColor?: string }) => void;
  onElementSelected?: (expressId: number | null) => void;
}

export function useSpatialSelection({
  currentProject,
  spatialTree,
  collaborators,
  elementLocks,
  collabClientRef,
  onLockNotification,
  onElementSelected
}: UseSpatialSelectionOptions) {
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null);
  const [isolatedExpressID, setIsolatedExpressID] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [pinnedExpressIds, setPinnedExpressIds] = useState<Set<number>>(new Set());
  const pinnedExpressIdsRef = useRef<Set<number>>(pinnedExpressIds);
  pinnedExpressIdsRef.current = pinnedExpressIds;

  const [selectedElementDetails, setSelectedElementDetails] = useState<ElementDetails | null>(null);
  const [focusTrigger, setFocusTrigger] = useState<{
    expressId: number;
    timestamp: number;
  } | null>(null);

  // Sync Element Details on Project or Selected ID change
  useEffect(() => {
    if (!currentProject || selectedExpressID === null) {
      setSelectedElementDetails(null);
      return;
    }
    let isMounted = true;
    api.getElementDetails(currentProject.id, selectedExpressID)
      .then((data) => {
        if (isMounted) setSelectedElementDetails(data);
      })
      .catch((err) => {
        console.error('Failed to load element details for capsule:', err);
      });
    return () => { isMounted = false; };
  }, [currentProject, selectedExpressID]);

  // Extract Storeys from Spatial Tree
  const storeys = useMemo(() => {
    if (!spatialTree) return [];
    const list: { id: number; name: string; elevation: number }[] = [];
    const traverse = (node: SpatialNode) => {
      if (node.type === 'IfcBuildingStorey') {
        list.push({ id: node.express_id, name: node.name, elevation: 0.0 });
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
          const details = await api.getElementDetails(currentProject.id, expressId);
          setSelectedElementDetails(details);
        }
      } catch (err) {
        console.error('Failed to toggle pin status:', err);
      }
    },
    [currentProject, selectedExpressID]
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
    storeys,
    focusTrigger,
    setFocusTrigger,
    triggerFocus,
    handleSelectElement,
    handleTogglePin
  };
}

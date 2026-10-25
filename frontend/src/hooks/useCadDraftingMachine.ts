import { useState, useCallback } from 'react';
import type {
  ProjectMetadata,
  CadToolMode,
  CadHistoryItem,
  SpatialNode,
  ElementDetails
} from '../types/ifc';
import type { InteractiveEditMode } from '../types/cadEditing';
import * as api from '../services/api';
import {
  buildDeleteElementRequest,
  runDestructiveAction
} from '../services/destructiveActions';
import {
  requestDestructiveConfirmation
} from '../services/destructiveConfirmation';
import type {
  DestructiveConfirm,
  DestructiveOutcome
} from '../services/destructiveActions';
import { notifyUser } from '../services/userMessages';
import type { UserMessageTone } from '../services/userMessages';

/** Result of the delete *executor* (it never prompts - the caller does, see `requestDeleteElement`). */
export interface DeleteElementResult {
  ok: boolean;
  error?: string;
}

export interface UseCadDraftingMachineOptions {
  currentProject: ProjectMetadata | null;
  selectedExpressID: number | null;
  pinnedExpressIdsRef: React.MutableRefObject<Set<number>>;
  loadProject: (project: ProjectMetadata, preserveSelectionId?: number | null) => Promise<void>;
  onSelectElement: (expressId: number | null) => void;
  onSpatialTreeUpdated?: (tree: SpatialNode) => void;
  onElementDetailsUpdated?: (details: ElementDetails) => void;
  /**
   * STEP-10: confirmation transport for destructive actions. Defaults to the app-wide dialog
   * bridge (`services/destructiveConfirmation.ts`), so no prop plumbing is required.
   */
  confirmDestructive?: DestructiveConfirm;
  /** STEP-10: replace the default `userMessages` channel with the host app's own UI. */
  onUserMessage?: (message: { text: string; tone: UserMessageTone }) => void;
}

export function useCadDraftingMachine({
  currentProject,
  selectedExpressID,
  pinnedExpressIdsRef,
  loadProject,
  onSelectElement,
  onSpatialTreeUpdated,
  onElementDetailsUpdated,
  confirmDestructive,
  onUserMessage
}: UseCadDraftingMachineOptions) {
  const [cadToolMode, setCadToolMode] = useState<CadToolMode>('select');
  const [activeInteractiveMode, setActiveInteractiveMode] = useState<InteractiveEditMode>('none');
  const [isMoveCopySpecialOpen, setIsMoveCopySpecialOpen] = useState(false);
  const [specialPickedPoints, setSpecialPickedPoints] = useState<{
    p1: [number, number, number];
    p2: [number, number, number];
  } | null>(null);

  const [cadWallHeight, setCadWallHeight] = useState(3.0);
  const [cadWallThickness, setCadWallThickness] = useState(0.2);
  const [cadCanUndo, setCadCanUndo] = useState(false);
  const [cadCanRedo, setCadCanRedo] = useState(false);
  const [cadHistory, setCadHistory] = useState<CadHistoryItem[]>([]);
  const [isCadOpen, setIsCadOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_ui_profile');
      return saved === 'modify' || !saved;
    } catch {
      return true;
    }
  });

  /**
   * STEP-10 Spec 11 — failures the user must see go through here, never a bare `console.error`.
   * Defaults to the app-wide `userMessages` channel (rendered by `UserMessageHost`).
   */
  const pushUserMessage = useCallback(
    (text: string, tone: UserMessageTone = 'error') => {
      if (onUserMessage) {
        onUserMessage({ text, tone });
        return;
      }
      notifyUser({ text, tone });
    },
    [onUserMessage]
  );

  const refreshCadHistory = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.fetchCadHistory(currentProject.id);
      setCadHistory(res.history);
      setCadCanUndo(res.can_undo);
      setCadCanRedo(res.can_redo);
    } catch (err) {
      console.error('Failed to fetch CAD history:', err);
    }
  }, [currentProject]);

  const handleCadDrawWall = useCallback(
    async (start: [number, number], end: [number, number]) => {
      if (!currentProject) return;
      try {
        await api.createCadWall(currentProject.id, {
          start,
          end,
          height: cadWallHeight,
          thickness: cadWallThickness,
          name: 'Parametric Wall'
        });
        await refreshCadHistory();
        await loadProject(currentProject);
      } catch (err) {
        console.error('Failed to create CAD wall:', err);
      }
    },
    [currentProject, cadWallHeight, cadWallThickness, refreshCadHistory, loadProject]
  );

  const handleCadDrawSlab = useCallback(
    async (c1: [number, number], c2: [number, number]) => {
      if (!currentProject) return;
      try {
        await api.createCadSlab(currentProject.id, {
          boundary: [c1, c2],
          thickness: 0.3,
          name: 'Parametric Slab'
        });
        await refreshCadHistory();
        await loadProject(currentProject);
      } catch (err) {
        console.error('Failed to create CAD slab:', err);
      }
    },
    [currentProject, refreshCadHistory, loadProject]
  );

  const handleCadDrawColumn = useCallback(
    async (pos: [number, number]) => {
      if (!currentProject) return;
      try {
        await api.createCadColumn(currentProject.id, {
          position: pos,
          height: cadWallHeight,
          width: 0.35,
          depth: 0.35,
          name: 'Parametric Column'
        });
        await refreshCadHistory();
        await loadProject(currentProject);
      } catch (err) {
        console.error('Failed to create CAD column:', err);
      }
    },
    [currentProject, cadWallHeight, refreshCadHistory, loadProject]
  );

  const handleCadDrawOpening = useCallback(
    async (wallId: number, offset: number, explicitType?: 'door' | 'window') => {
      if (!currentProject) return;
      const isDoor = explicitType ? explicitType === 'door' : cadToolMode === 'door';
      try {
        await api.createCadOpening(currentProject.id, {
          host_wall_id: wallId,
          opening_type: isDoor ? 'door' : 'window',
          offset_along_wall: offset,
          width: isDoor ? 0.9 : 1.2,
          height: isDoor ? 2.1 : 1.4,
          sill_height: isDoor ? 0.0 : 0.9,
          name: isDoor ? 'Parametric Door' : 'Parametric Window'
        });
        await refreshCadHistory();
        await loadProject(currentProject);
      } catch (err) {
        console.error('Failed to create CAD opening:', err);
      }
    },
    [currentProject, cadToolMode, refreshCadHistory, loadProject]
  );

  const handleCadUndo = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.undoCad(currentProject.id);
      if (res.success === false) {
        // STEP-10 Spec 11 — a no-op undo is reported to the user, not swallowed.
        pushUserMessage(
          res.message ? `Undo failed: ${res.message}` : 'Undo failed: nothing to undo.'
        );
        await refreshCadHistory();
        return;
      }
      await refreshCadHistory();
      await loadProject(currentProject, res.affected_express_id || selectedExpressID);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('Failed to undo CAD action:', err);
      pushUserMessage(`Undo failed: ${detail}`);
      await refreshCadHistory();
    }
  }, [currentProject, refreshCadHistory, loadProject, selectedExpressID, pushUserMessage]);

  const handleCadRedo = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.redoCad(currentProject.id);
      if (res.success === false) {
        pushUserMessage(
          res.message ? `Redo failed: ${res.message}` : 'Redo failed: nothing to redo.'
        );
        await refreshCadHistory();
        return;
      }
      await refreshCadHistory();
      await loadProject(currentProject, res.affected_express_id || selectedExpressID);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('Failed to redo CAD action:', err);
      pushUserMessage(`Redo failed: ${detail}`);
      await refreshCadHistory();
    }
  }, [currentProject, refreshCadHistory, loadProject, selectedExpressID, pushUserMessage]);

  /**
   * STEP-10 — the *executor* for deletes. It deliberately does not prompt: every trigger gates
   * through `requestDeleteElement` (or `runDestructiveAction` directly) first. Failures are
   * returned *and* surfaced, so a caller can react without the user ever seeing a silent no-op.
   */
  const handleDeleteElement = useCallback(
    async (expressId: number): Promise<DeleteElementResult> => {
      if (!currentProject) {
        return { ok: false, error: 'No project is open.' };
      }
      if (pinnedExpressIdsRef.current.has(expressId)) {
        const error = `Element #${expressId} is pinned. Unpin (UP) to delete.`;
        console.warn(error);
        pushUserMessage(error, 'info');
        return { ok: false, error };
      }
      try {
        const res = await api.deleteElement(currentProject.id, expressId);
        if (res && res.success === false) {
          const error = res.message || `Delete of element #${expressId} was rejected.`;
          console.warn(error);
          pushUserMessage(`Could not delete element #${expressId}: ${error}`);
          return { ok: false, error };
        }
        onSelectElement(null);
        await refreshCadHistory();
        await loadProject(currentProject);
        return { ok: true };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('Failed to delete element:', err);
        pushUserMessage(`Could not delete element #${expressId}: ${detail}`);
        return { ok: false, error: detail };
      }
    },
    [
      currentProject,
      pinnedExpressIdsRef,
      onSelectElement,
      refreshCadHistory,
      loadProject,
      pushUserMessage
    ]
  );

  /**
   * STEP-10 Spec 8-10 — the *gated* delete every trigger must call. Confirmation defaults to the
   * app-wide dialog bridge, so cancelling leaves the model untouched.
   */
  const requestDeleteElement = useCallback(
    async (expressId: number, label?: string): Promise<DestructiveOutcome<DeleteElementResult>> => {
      if (!currentProject) return { applied: false };
      const subject = label && label.trim() ? label.trim() : `Element #${expressId}`;
      const request = buildDeleteElementRequest(expressId, subject);
      return runDestructiveAction(
        request,
        confirmDestructive ?? requestDestructiveConfirmation,
        () => handleDeleteElement(expressId)
      );
    },
    [currentProject, confirmDestructive, handleDeleteElement]
  );

  const handleMoveElement = useCallback(
    async (expressId: number, delta: [number, number, number]) => {
      if (!currentProject) return;
      if (pinnedExpressIdsRef.current.has(expressId)) {
        console.warn(`Element #${expressId} is pinned. Unpin (UP) to move.`);
        return;
      }
      try {
        await api.moveElement(currentProject.id, expressId, { delta });
        await refreshCadHistory();
      } catch (err) {
        console.error('Failed to move element:', err);
      }
    },
    [currentProject, pinnedExpressIdsRef, refreshCadHistory]
  );

  const handleRotateElement = useCallback(
    async (expressId: number, angleDegrees: number = 90, axis: 'x' | 'y' | 'z' = 'z') => {
      if (!currentProject) return;
      if (pinnedExpressIdsRef.current.has(expressId)) {
        console.warn(`Element #${expressId} is pinned. Unpin (UP) to rotate.`);
        return;
      }
      try {
        await api.rotateElement(currentProject.id, expressId, { angle_degrees: angleDegrees, axis });
        await refreshCadHistory();
      } catch (err) {
        console.error('Failed to rotate element:', err);
      }
    },
    [currentProject, pinnedExpressIdsRef, refreshCadHistory]
  );

  const handleMirrorElement = useCallback(
    async (expressId: number, axis: 'x' | 'y' | 'z' = 'x', isCopy: boolean = false) => {
      if (!currentProject) return;
      if (!isCopy && pinnedExpressIdsRef.current.has(expressId)) {
        console.warn(`Element #${expressId} is pinned. Unpin (UP) to mirror.`);
        return;
      }
      try {
        const res = await api.mirrorElement(currentProject.id, expressId, { axis, is_copy: isCopy });
        await refreshCadHistory();
        if (isCopy) {
          const newId = res.express_id || expressId;
          await loadProject(currentProject, newId);
        }
      } catch (err) {
        console.error('Failed to mirror element:', err);
      }
    },
    [currentProject, pinnedExpressIdsRef, refreshCadHistory, loadProject]
  );

  const handleArrayElement = useCallback(
    async (expressId: number, count: number = 3, delta: [number, number, number] = [2.0, 0, 0]) => {
      if (!currentProject) return;
      try {
        const res = await api.arrayElement(currentProject.id, expressId, { count, delta });
        await refreshCadHistory();
        const firstId = res.length > 0 && res[0].express_id ? res[0].express_id : expressId;
        await loadProject(currentProject, firstId);
      } catch (err) {
        console.error('Failed to array element:', err);
      }
    },
    [currentProject, refreshCadHistory, loadProject]
  );

  const handleAlignElement = useCallback(
    async (expressId: number, axis: 'x' | 'y' | 'z' = 'z', targetValue: number = 0.0) => {
      if (!currentProject) return;
      if (pinnedExpressIdsRef.current.has(expressId)) {
        console.warn(`Element #${expressId} is pinned. Unpin (UP) to align.`);
        return;
      }
      try {
        await api.alignElement(currentProject.id, expressId, {
          align_type: 'origin',
          axis,
          target_value: targetValue
        });
        await refreshCadHistory();
        await loadProject(currentProject, expressId);
      } catch (err) {
        console.error('Failed to align element:', err);
      }
    },
    [currentProject, pinnedExpressIdsRef, refreshCadHistory, loadProject]
  );

  const handleCloneElement = useCallback(
    async (expressId: number) => {
      if (!currentProject) return;
      try {
        const res = await api.cloneElement(currentProject.id, expressId, { delta: [1.5, 0.0, 0.0] });
        await refreshCadHistory();
        const newId = res.express_id || expressId;
        await loadProject(currentProject, newId);
      } catch (err) {
        console.error('Failed to clone element:', err);
      }
    },
    [currentProject, refreshCadHistory, loadProject]
  );

  const handleUpdateGeometry = useCallback(
    async (
      expressId: number,
      params: { height?: number; thickness?: number; elevation?: number }
    ) => {
      if (!currentProject) return;
      try {
        await api.updateElementGeometry(currentProject.id, expressId, params);
        await refreshCadHistory();
        await loadProject(currentProject, expressId);
      } catch (err) {
        console.error('Failed to update geometry:', err);
      }
    },
    [currentProject, refreshCadHistory, loadProject]
  );

  const handleAssignStorey = useCallback(
    async (expressId: number, storeyId: number) => {
      if (!currentProject) return;
      try {
        await api.assignElementStorey(currentProject.id, expressId, { storey_id: storeyId });
        const tree = await api.fetchSpatialTree(currentProject.id);
        onSpatialTreeUpdated?.(tree);
      } catch (err) {
        console.error('Failed to assign storey:', err);
      }
    },
    [currentProject, onSpatialTreeUpdated]
  );

  const handleAssignMaterial = useCallback(
    async (expressId: number, materialName: string, colorHex?: string) => {
      if (!currentProject) return;
      try {
        await api.assignElementMaterial(currentProject.id, expressId, {
          material_name: materialName,
          color_hex: colorHex
        });
        const updated = await api.getElementDetails(currentProject.id, expressId);
        onElementDetailsUpdated?.(updated);
      } catch (err) {
        console.error('Failed to assign material:', err);
      }
    },
    [currentProject, onElementDetailsUpdated]
  );

  return {
    cadToolMode,
    setCadToolMode,
    activeInteractiveMode,
    setActiveInteractiveMode,
    isMoveCopySpecialOpen,
    setIsMoveCopySpecialOpen,
    specialPickedPoints,
    setSpecialPickedPoints,
    cadWallHeight,
    setCadWallHeight,
    cadWallThickness,
    setCadWallThickness,
    cadCanUndo,
    cadCanRedo,
    cadHistory,
    isCadOpen,
    setIsCadOpen,
    refreshCadHistory,
    handleCadDrawWall,
    handleCadDrawSlab,
    handleCadDrawColumn,
    handleCadDrawOpening,
    handleCadUndo,
    handleCadRedo,
    handleDeleteElement,
    requestDeleteElement,
    handleMoveElement,
    handleRotateElement,
    handleMirrorElement,
    handleArrayElement,
    handleAlignElement,
    handleCloneElement,
    handleUpdateGeometry,
    handleAssignStorey,
    handleAssignMaterial
  };
}

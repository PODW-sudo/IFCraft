import { useState, useCallback } from 'react';
import type { TransformMode } from '../components/viewer/ThreeViewport';
import type { ProjectMetadata } from '../types/ifc';
import type { CollaborationClient } from '../services/collaboration';
import { withSaveStatus } from '../services/saveStatus';
import { notifyUser } from '../services/userMessages';
import { apiFetch } from '../services/api';
import {
  clearPreDragMatrix,
  readPreDragMatrix,
  restoreSceneMatrix
} from '../services/meshMatrixBridge';

export interface UseGizmoTransformOptions {
  currentProject: ProjectMetadata | null;
  collabClientRef: React.RefObject<CollaborationClient | null>;
}

/**
 * STEP-02 / F-002 — the single-user placement write.
 *
 * Kept out of `handleTransformEnd` on purpose: the callback must contain exactly one persistence
 * call, so the REST fallback is a named branch, not a second inline request. The route can answer
 * 409 when another user holds the soft lock.
 */
async function persistPlacementViaRest(
  projectId: string,
  expressID: number,
  matrix: number[]
): Promise<void> {
  // STEP-05 / F-003: `apiFetch` attaches the API token; a raw `fetch` here answers 401.
  const res = await apiFetch(`/api/projects/${projectId}/elements/${expressID}/placement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matrix })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Failed to persist transform (HTTP ${res.status})`);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useGizmoTransform({ currentProject, collabClientRef }: UseGizmoTransformOptions) {
  const [transformMode, setTransformMode] = useState<TransformMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [transformInfo, setTransformInfo] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);

  const toggleSnap = useCallback(() => {
    setSnapEnabled((prev) => !prev);
  }, []);

  const handleTransformChange = useCallback(
    (_expressID: number, pos: [number, number, number], rot: [number, number, number]) => {
      setTransformInfo({ position: pos, rotation: rot });
    },
    []
  );

  const handleTransformEnd = useCallback(
    async (expressID: number, matrix: number[]) => {
      if (!currentProject) return;

      // Captured by the viewport when the drag started; the mesh already holds the new matrix.
      const previousMatrix = readPreDragMatrix(expressID);
      const collab = collabClientRef.current;

      try {
        // STEP-02 / F-002: exactly one destination per drag release. Both used to run, and both
        // rewrite the whole model file - the WS one is kept because it carries the soft-lock
        // check, the edit_history row and the broadcast.
        await withSaveStatus(async () => {
          if (collab) {
            collab.commitTransform(expressID, matrix);
            return;
          }
          await persistPlacementViaRest(currentProject.id, expressID, matrix);
        });
        clearPreDragMatrix(expressID);
      } catch (err) {
        // STEP-02 spec 5: never leave the screen showing a move the file does not contain.
        if (previousMatrix !== null) {
          restoreSceneMatrix(expressID, previousMatrix);
        }
        clearPreDragMatrix(expressID);
        notifyUser({
          text: `Move not saved: ${describeError(err)} The element was put back where it was.`,
          tone: 'error'
        });
      }
    },
    [currentProject, collabClientRef]
  );

  const resetTransform = useCallback(() => {
    setTransformInfo(null);
    setTransformMode('select');
  }, []);

  return {
    transformMode,
    setTransformMode,
    snapEnabled,
    setSnapEnabled,
    toggleSnap,
    transformInfo,
    setTransformInfo,
    handleTransformChange,
    handleTransformEnd,
    resetTransform
  };
}

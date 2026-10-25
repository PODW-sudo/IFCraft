/**
 * STEP-02 / F-002, F-018 — the one seam the gizmo hook needs into the 3D scene.
 *
 * `useGizmoTransform` owns persistence; `ThreeViewport` owns the meshes. Before this module the
 * hook had no way to put an element back after a failed write, so a rejected placement left the
 * screen showing a move the file did not contain (spec 5).
 *
 * The bridge is deliberately tiny and dependency-free:
 *  - the viewport registers a handle once (read/write a world matrix by express id),
 *  - the viewport records the pre-drag matrix when a gizmo drag starts,
 *  - the hook restores that matrix when a persistence call fails.
 *
 * No React, no THREE types: the hook is unit-tested in jsdom with a fake handle, and the viewport
 * is the only module that knows about meshes.
 */

export interface SceneMatrixHandle {
  /** Current world matrix of the element (column-major, 16 numbers), or null if not in the scene. */
  read: (expressID: number) => number[] | null;
  /** Write a world matrix back into the scene without persisting it. Returns false if unknown. */
  write: (expressID: number, matrix: number[]) => boolean;
}

let handle: SceneMatrixHandle | null = null;

/**
 * Matrices captured at drag start, keyed by express id. Kept outside the handle so a scene
 * rebuild (geometry reload) between drag start and commit cannot lose the rollback target.
 */
const preDragMatrices = new Map<number, number[]>();

/** Called by the viewport on mount; the returned function unregisters it. */
export function registerSceneMatrixHandle(next: SceneMatrixHandle): () => void {
  handle = next;
  return () => {
    if (handle === next) {
      handle = null;
    }
  };
}

/** Current on-screen matrix, or null when no viewport is mounted. */
export function readSceneMatrix(expressID: number): number[] | null {
  return handle?.read(expressID) ?? null;
}

/** Put an element back where it was. Returns false when nothing could be restored. */
export function restoreSceneMatrix(expressID: number, matrix: number[]): boolean {
  return handle?.write(expressID, matrix) ?? false;
}

/** Called by the viewport when a gizmo drag begins (`dragging-changed` -> true). */
export function capturePreDragMatrix(expressID: number, matrix: number[]): void {
  preDragMatrices.set(expressID, matrix.slice());
}

/** The rollback target for a commit that is about to be persisted, or null if none was captured. */
export function readPreDragMatrix(expressID: number): number[] | null {
  return preDragMatrices.get(expressID) ?? null;
}

/** Drop the rollback target once the commit has been resolved either way. */
export function clearPreDragMatrix(expressID: number): void {
  preDragMatrices.delete(expressID);
}

/** Test seam: forget the registered scene and every captured matrix. */
export function resetMeshMatrixBridge(): void {
  handle = null;
  preDragMatrices.clear();
}

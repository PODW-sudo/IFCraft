/**
 * Per-instance visibility and colour for the `THREE.BatchedMesh` render path.
 *
 * Deliberately free of `three` imports: the only collaborator is a minimal
 * `BatchLike` handle exposing `setVisibleAt` / `setColorAt`, which keeps these
 * rules unit-testable without WebGL. `createBatchLike` adapts a real
 * `THREE.BatchedMesh` (whose `setColorAt` wants a `THREE.Color`) to that contract,
 * so every rule here can speak hex numbers.
 */

/** White used whenever an instance has no explicit per-element colour. */
export const WHITE = 0xffffff;

export interface InstanceRef {
  expressID: number;
  type: string;
  /** Federation model id; absent means the single-model `'main'` bucket. */
  modelId?: string;
  /** Discipline bucket recorded at batch build time (Discipline render style). */
  discipline?: string;
  /** Monotonic id returned by `BatchedMesh.addInstance`. Defaults to the array index. */
  instanceId?: number;
}

export interface VisibilityState {
  hiddenCategories: Set<string>;
  isolatedExpressID: number | null;
  hiddenModelIds?: Set<string> | null;
}

export interface BatchLike {
  setVisibleAt(id: number, visible: boolean): void;
  setColorAt?(id: number, color: number): void;
}

export interface BatchRegistryEntry {
  mesh: BatchLike;
  instances: InstanceRef[];
}

/** Structural view of a real renderer batch (THREE.BatchedMesh satisfies it). */
export interface RawBatchHandle<ColorType> {
  setVisibleAt(id: number, visible: boolean): unknown;
  setColorAt(id: number, color: ColorType): unknown;
}

/**
 * Adapts a real batch handle to `BatchLike`.
 *
 * This is the single place in the app that calls `setVisibleAt` / `setColorAt`, which
 * keeps the seam testable: `THREE.BatchedMesh.setColorAt` wants a colour object, while
 * every rule in this module speaks hex numbers.
 */
export function createBatchLike<ColorType>(
  raw: RawBatchHandle<ColorType>,
  makeColor: (hex: number) => ColorType
): BatchLike {
  return {
    setVisibleAt: (id: number, visible: boolean) => {
      raw.setVisibleAt(id, visible);
    },
    setColorAt: (id: number, hex: number) => {
      raw.setColorAt(id, makeColor(hex));
    }
  };
}

/**
 * Pure predicate shared by the render path and the pick/highlight paths:
 * an instance is visible unless its category is hidden, a single-element
 * isolation excludes it, or its federation model is hidden.
 */
export function isInstanceVisible(instance: InstanceRef, state: VisibilityState): boolean {
  if (state.hiddenCategories.has(instance.type)) return false;
  if (state.isolatedExpressID !== null && instance.expressID !== state.isolatedExpressID) return false;
  const modelId = instance.modelId ?? 'main';
  if (state.hiddenModelIds && state.hiddenModelIds.has(modelId)) return false;
  return true;
}

/**
 * Applies the visibility state to every registered batch instance.
 *
 * Never touches `mesh.visible`: the `BatchedMesh` itself must stay visible so
 * `onBeforeRender` keeps running and can re-show instances later. Calling this
 * twice with the same state produces the same call sequence (idempotent).
 */
export function applyBatchVisibility(
  entries: BatchRegistryEntry[],
  state: VisibilityState
): { hidden: number; shown: number } {
  let hidden = 0;
  let shown = 0;

  entries.forEach((entry) => {
    entry.instances.forEach((instance, index) => {
      const visible = isInstanceVisible(instance, state);
      const instanceId = instance.instanceId ?? index;
      entry.mesh.setVisibleAt(instanceId, visible);
      if (visible) shown += 1;
      else hidden += 1;
    });
  });

  return { hidden, shown };
}

/**
 * Paints every registered instance: the mapped colour when present, pure white
 * otherwise. Returns the number of instances that received a non-white colour.
 *
 * Call with an empty map to reset all instances to white when a render style
 * has no per-element meaning (Solid, Ghost, Wireframe, Materials).
 */
export function applyInstanceColors(
  entries: BatchRegistryEntry[],
  colorsByExpressId: Map<number, number>
): number {
  let painted = 0;

  entries.forEach((entry) => {
    entry.instances.forEach((instance, index) => {
      const instanceId = instance.instanceId ?? index;
      const mapped = colorsByExpressId.get(instance.expressID);
      const color = mapped === undefined ? WHITE : mapped;
      entry.mesh.setColorAt?.(instanceId, color);
      if (color !== WHITE) painted += 1;
    });
  });

  return painted;
}

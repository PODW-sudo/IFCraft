import * as THREE from 'three';

export interface SceneTeardownOptions {
  /** Material pools keyed by category / discipline; disposed once and emptied. */
  materialPools?: Iterable<Map<string, THREE.Material>>;
  /** Registries (mesh map, edge caches, ...) cleared after disposal. */
  registries?: Iterable<Map<unknown, unknown>>;
}

export interface SceneTeardownCounts {
  geometries: number;
  materials: number;
}

/**
 * Objects already disposed by a previous teardown pass. Module level so that a
 * second `disposeSceneGraph` call on the same graph is a genuine no-op rather
 * than a double `dispose()` on a live GPU resource.
 */
const disposedGeometries = new WeakSet<THREE.BufferGeometry>();
const disposedMaterials = new WeakSet<THREE.Material>();

/**
 * Full scene teardown: dispose every geometry under `root` (except borrowed ones
 * marked `isSharedGeometry`), every pooled material, clear the registries and
 * detach `root` from the scene.
 *
 * Idempotent: the second call disposes nothing and returns zero counts.
 */
export function disposeSceneGraph(
  root: THREE.Object3D | null,
  scene: THREE.Scene | null,
  options: SceneTeardownOptions = {}
): SceneTeardownCounts {
  let geometries = 0;
  let materials = 0;

  const disposeMaterial = (material: THREE.Material | undefined | null) => {
    if (!material || disposedMaterials.has(material)) return;
    disposedMaterials.add(material);
    material.dispose();
    materials += 1;
  };

  // 1. Pooled materials are shared by many meshes, so they go first and are deduped.
  if (options.materialPools) {
    for (const pool of options.materialPools) {
      pool.forEach((material) => disposeMaterial(material));
      pool.clear();
    }
  }

  // 2. Every geometry the graph owns.
  root?.traverse((obj) => {
    const holder = obj as THREE.Mesh;
    const geometry = holder.geometry as THREE.BufferGeometry | undefined;
    if (!geometry || obj.userData?.isSharedGeometry) return;
    if (disposedGeometries.has(geometry)) return;
    disposedGeometries.add(geometry);
    geometry.dispose();
    geometries += 1;
  });

  // 3. Materials referenced by meshes but absent from any pool (ghost previews, helpers).
  root?.traverse((obj) => {
    const holder = obj as THREE.Mesh;
    if (!holder.material) return;
    const list = Array.isArray(holder.material) ? holder.material : [holder.material];
    list.forEach((material) => disposeMaterial(material));
  });

  // 4. Detach and forget.
  if (root) {
    scene?.remove(root);
    root.removeFromParent();
  }

  if (options.registries) {
    for (const registry of options.registries) {
      registry.clear();
    }
  }

  return { geometries, materials };
}

import * as THREE from 'three';

/**
 * Marks an object whose geometry is borrowed from the model and therefore must
 * never be disposed by highlight teardown. Spreading the existing userData keeps
 * markers such as `sourceMesh` intact.
 */
export function markSharedGeometry(object: THREE.Object3D): void {
  object.userData = { ...object.userData, isSharedGeometry: true };
}

/**
 * Tears a highlight group down: removes it from the scene, disposes the
 * geometries it *owns* and every material it created.
 *
 * A geometry marked with `markSharedGeometry` (the surface wash overlays borrow
 * `mesh.geometry`, and cached contour edges are owned by the edge cache) is left
 * alive - disposing it would force WebGL to re-upload the model on the next hover.
 */
export function disposeHighlightGroup(group: THREE.Group | null, scene: THREE.Scene | null): void {
  if (!group) return;
  if (scene) scene.remove(group);
  group.traverse((obj) => {
    const holder = obj as THREE.Mesh;
    if (holder.geometry && !obj.userData?.isSharedGeometry) {
      holder.geometry.dispose();
    }
    if (holder.material) {
      const materials = Array.isArray(holder.material) ? holder.material : [holder.material];
      materials.forEach((m) => m?.dispose?.());
    }
  });
  group.clear();
}

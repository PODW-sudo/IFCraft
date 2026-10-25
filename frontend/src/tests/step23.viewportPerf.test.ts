import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

import {
  disposeHighlightGroup,
  markSharedGeometry
} from '../components/viewer/highlightDisposal';
import { createHoverScheduler } from '../components/viewer/hoverScheduler';
import { disposeSceneGraph } from '../components/viewer/sceneTeardown';
import { createNavigationTuning } from '../components/viewer/navigationTuning';

function makeFrameQueue() {
  const queue: Array<() => void> = [];
  return {
    requestFrame: (cb: () => void) => {
      queue.push(cb);
      return queue.length;
    },
    cancelFrame: () => {
      queue.length = 0;
    },
    flush: () => {
      const pending = queue.splice(0, queue.length);
      pending.forEach((cb) => cb());
    },
    get size() {
      return queue.length;
    }
  };
}

describe('highlight disposal (F-033)', () => {
  it('must not dispose geometry owned by the model', () => {
    const modelGeometry = new THREE.BoxGeometry(1, 1, 1);
    const modelDispose = vi.spyOn(modelGeometry, 'dispose');
    const scene = new THREE.Scene();
    const group = new THREE.Group();

    const overlay = new THREE.Mesh(modelGeometry, new THREE.MeshBasicMaterial());
    markSharedGeometry(overlay);
    group.add(overlay);
    scene.add(group);

    disposeHighlightGroup(group, scene);

    expect(modelDispose).not.toHaveBeenCalled();
    expect(scene.children).not.toContain(group);
  });

  it('disposes highlight geometry it owns', () => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1), 24);
    const edgesDispose = vi.spyOn(edges, 'dispose');
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial()));
    scene.add(group);

    disposeHighlightGroup(group, scene);

    expect(edgesDispose).toHaveBeenCalledTimes(1);
  });
});

describe('hover scheduler (F-034)', () => {
  it('coalesces pointer moves into one compute per frame, using the latest event', () => {
    const frames = makeFrameQueue();
    const compute = vi.fn(() => [7]);
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    scheduler.schedule({ clientX: 2, clientY: 2 });
    scheduler.schedule({ clientX: 3, clientY: 3 });

    expect(compute).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);

    frames.flush();

    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith({ clientX: 3, clientY: 3 });
  });

  it('does not notify when the hovered set is unchanged', () => {
    const frames = makeFrameQueue();
    const notify = vi.fn();
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute: () => [7, 9],
      notify
    });

    scheduler.schedule({ clientX: 10, clientY: 10 });
    frames.flush();
    scheduler.schedule({ clientX: 11, clientY: 11 });
    frames.flush();
    scheduler.schedule({ clientX: 12, clientY: 12 });
    frames.flush();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith([7, 9]);
  });

  it('notifies once per real change', () => {
    const frames = makeFrameQueue();
    const notify = vi.fn();
    let next = [7];
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute: () => next,
      notify
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    frames.flush();
    next = [11];
    scheduler.schedule({ clientX: 2, clientY: 2 });
    frames.flush();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith([11]);
  });

  it('cancel drops the pending frame', () => {
    const frames = makeFrameQueue();
    const compute = vi.fn(() => []);
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    scheduler.cancel();
    expect(frames.size).toBe(0);
    frames.flush();
    expect(compute).not.toHaveBeenCalled();
  });
});

describe('scene teardown (F-037)', () => {
  it('disposes mesh geometry, pooled materials and clears registries', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();

    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');

    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    scene.add(root);

    const pool = new Map<string, THREE.Material>([['IfcWall', material]]);
    const meshMap = new Map<number, THREE.Mesh[]>([[1, [mesh]]]);

    const result = disposeSceneGraph(root, scene, {
      materialPools: [pool],
      registries: [meshMap]
    });

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(meshMap.size).toBe(0);
    expect(scene.children).not.toContain(root);
    expect(result.geometries).toBe(1);
    expect(result.materials).toBe(1);
  });

  it('is idempotent', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    root.add(new THREE.Mesh(geometry, material));
    scene.add(root);

    disposeSceneGraph(root, scene, {});
    const second = disposeSceneGraph(root, scene, {});

    expect(second.geometries).toBe(0);
    expect(second.materials).toBe(0);
  });
});

describe('navigation tuning (F-038)', () => {
  it('switches to the large-model damping once the count crosses the threshold', () => {
    const tuning = createNavigationTuning(0.18, { adaptive: true, threshold: 150 });

    expect(tuning.update(10)).toBeCloseTo(0.18);
    expect(tuning.current).toBeCloseTo(0.18);

    expect(tuning.update(151)).toBeCloseTo(0.25);
    expect(tuning.current).toBeCloseTo(0.25);

    expect(tuning.update(20)).toBeCloseTo(0.18);
  });

  it('never raises damping when adaptive is disabled', () => {
    const tuning = createNavigationTuning(0.18, { adaptive: false, threshold: 150 });
    expect(tuning.update(5000)).toBeCloseTo(0.18);
  });
});

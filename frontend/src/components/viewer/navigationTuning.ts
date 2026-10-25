export interface NavigationTuningOptions {
  /** When false the damping factor never adapts to model size. */
  adaptive?: boolean;
  /** Element count above which the large-model damping floor applies. */
  threshold?: number;
  /** Minimum damping factor used for large models. */
  largeFloor?: number;
}

export interface NavigationTuning {
  /** Recomputes the damping factor for the given element count and returns it. */
  update(count: number): number;
  /** The damping factor produced by the last `update`. */
  readonly current: number;
}

/**
 * Single source of truth for the adaptive damping decision.
 *
 * The viewport used to compute `geometries.length > 150` in two different
 * effects - one of which captured the empty first render - so the answer
 * depended on which effect ran last. This keeps one answer.
 */
export function createNavigationTuning(
  baseDamping: number,
  options: NavigationTuningOptions = {}
): NavigationTuning {
  const { adaptive = true, threshold = 150, largeFloor = 0.25 } = options;

  let current = baseDamping;

  return {
    get current() {
      return current;
    },
    update(count: number) {
      current = adaptive && count > threshold ? Math.max(baseDamping, largeFloor) : baseDamping;
      return current;
    }
  };
}

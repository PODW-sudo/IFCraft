export interface PointerPayload {
  clientX: number;
  clientY: number;
}

export interface HoverSchedulerOptions {
  requestFrame: (cb: () => void) => number;
  cancelFrame: (handle: number) => void;
  compute: (payload: PointerPayload) => number[];
  notify?: (ids: number[]) => void;
  equals?: (a: number[], b: number[]) => boolean;
}

export interface HoverScheduler {
  schedule(payload: PointerPayload): void;
  cancel(): void;
}

const defaultEquals = (a: number[], b: number[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/**
 * Coalesces pointer moves into at most one raycast per animation frame and only
 * notifies when the resulting candidate set actually changed.
 *
 * The cost this removes is the raycast, not the React commit: deferring the
 * commit would still run `compute` for every event.
 */
export function createHoverScheduler(options: HoverSchedulerOptions): HoverScheduler {
  const { requestFrame, cancelFrame, compute, notify, equals = defaultEquals } = options;

  let frameHandle: number | null = null;
  let latestPayload: PointerPayload | null = null;
  let previous: number[] | null = null;

  const runFrame = () => {
    frameHandle = null;
    const payload = latestPayload;
    if (!payload) return;

    const next = compute(payload);
    if (previous === null || !equals(previous, next)) {
      previous = next;
      notify?.(next);
    }
  };

  return {
    schedule(payload: PointerPayload) {
      latestPayload = payload;
      if (frameHandle !== null) return;
      frameHandle = requestFrame(runFrame);
    },
    cancel() {
      if (frameHandle !== null) {
        cancelFrame(frameHandle);
        frameHandle = null;
      }
      latestPayload = null;
      // Drop the dedupe baseline: whoever cancels has just invalidated the hover
      // state (pointer left, drag started), so the next compute must notify even if
      // it lands on the same element set.
      previous = null;
    }
  };
}

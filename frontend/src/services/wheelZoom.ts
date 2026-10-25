/**
 * Native wheel zoom for the drawing sheet preview (STEP-24, F-041).
 *
 * React attaches `wheel` at the root as a **passive** listener (React 17+), so calling
 * `preventDefault()` inside an `onWheel` prop is a no-op and Chromium logs
 * `Unable to preventDefault inside passive event listener invocation` into the console the QA gate
 * reads. Registering the listener here with `{ passive: false }` is the only way to make
 * `preventDefault()` effective.
 */

export interface WheelZoomTarget {
  addEventListener(
    type: 'wheel',
    handler: (event: WheelEvent) => void,
    options?: AddEventListenerOptions
  ): void;
  removeEventListener(type: 'wheel', handler: (event: WheelEvent) => void): void;
}

export interface WheelZoomOptions {
  /** Called once per wheel event with the direction implied by the sign of `deltaY`. */
  onZoom: (direction: 'in' | 'out') => void;
  /**
   * Optional multiplier the caller may apply per notch (e.g. `1.1`). Not used by this module: it
   * only classifies the event, the caller owns the zoom arithmetic and its clamps.
   */
  step?: number;
}

/**
 * Registers exactly one non-passive `wheel` listener on `target` and returns a disposer.
 * `deltaY < 0` is "zoom in" (scroll up / pinch out), anything else is "zoom out".
 */
export function createWheelZoom(target: WheelZoomTarget, options: WheelZoomOptions): () => void {
  const handler = (event: WheelEvent) => {
    event.preventDefault();
    options.onZoom(event.deltaY < 0 ? 'in' : 'out');
  };

  target.addEventListener('wheel', handler, { passive: false });

  return () => target.removeEventListener('wheel', handler);
}

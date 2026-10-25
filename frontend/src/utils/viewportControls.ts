/**
 * STEP-28 / F-052 - OrbitControls configuration for mouse **and** touch.
 *
 * ThreeViewport used to inline `mouseButtons` (left/right disabled so left-click stays free
 * for CAD selection, middle-drag pans, Shift+middle-drag orbits) and never configured
 * `touches`, so a tablet fell back to OrbitControls' defaults with no one-finger orbit.
 *
 * Keeping the literal here makes both halves testable without a WebGL context: jsdom has
 * no pointer input, so the config is the only verifiable part of the touch story.
 */

import { MOUSE, TOUCH } from 'three';

export interface OrbitControlConfig {
  mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };
  touches: { ONE: TOUCH; TWO: TOUCH };
}

export function buildOrbitControlConfig(): OrbitControlConfig {
  return {
    // -1 disables the button (three treats any value outside the MOUSE enum as "none"),
    // so a left click is 100% available to selection / CAD commands.
    mouseButtons: {
      LEFT: -1 as MOUSE,
      MIDDLE: MOUSE.PAN,
      RIGHT: -1 as MOUSE
    },
    // One finger orbits, two fingers dolly + pan (the standard BIM tablet gesture).
    touches: {
      ONE: TOUCH.ROTATE,
      TWO: TOUCH.DOLLY_PAN
    }
  };
}

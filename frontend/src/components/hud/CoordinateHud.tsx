import React from 'react';
import { buildCoordinateReadout } from '../../utils/coordinateReadout';

/**
 * Live coordinate readout chip (STEP-12 / F-009).
 *
 * Payload contract, grepped by `scripts/qa_runner.py` (`[data-qa=coordinate-hud]` must
 * exist, `innerText` must contain `meshes` and `#<id>`):
 *   "<n> meshes"                          -> readout.meshText
 *   "#<id> X +1.234m Y +0.000m Z -2.100m" -> readout.positionText
 *
 * Formatting (sign, three decimals via toFixed(3), trailing "m", never a negative zero)
 * lives in `utils/coordinateReadout.ts`, shared with the tests and the omnibar.
 *
 * Visibility rules: always rendered (no hover/focus needed), non-interactive
 * (`pointer-events-none` so an orbit drag starting over it still orbits), and not a live
 * region (`aria-live="off"`) because it changes on every pointer move.
 */
interface CoordinateHudProps {
  selectedExpressID: number | null;
  transformInfo: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
  elementCount: number;
  isTreeOpen?: boolean;
  treeWidth?: number;
}

export const CoordinateHud: React.FC<CoordinateHudProps> = ({
  selectedExpressID,
  transformInfo,
  elementCount,
  isTreeOpen = false,
  treeWidth
}) => {
  const readout = buildCoordinateReadout({ selectedExpressID, transformInfo, elementCount });

  return (
    <div
      data-qa="coordinate-hud"
      aria-label="Coordinate readout"
      aria-live="off"
      style={{
        left: isTreeOpen ? (treeWidth ?? 0) + 8 : undefined,
        fontVariantNumeric: 'tabular-nums'
      }}
      className="pointer-events-none absolute bottom-4 left-4 z-10 flex max-w-[calc(100%_-_2rem)] items-center gap-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--dock-translucent)] px-3 py-1.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)] shadow-[var(--shadow-hud)] backdrop-blur-xl"
    >
      <span data-qa="coordinate-hud-meshes" className="truncate">
        {readout.meshText}
      </span>
      {readout.positionText && (
        <span data-qa="coordinate-hud-position" className="truncate text-[var(--text-primary)]">
          {readout.positionText}
        </span>
      )}
    </div>
  );
};

export default CoordinateHud;

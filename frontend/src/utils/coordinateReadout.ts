/**
 * STEP-12 / F-009 - pure formatting for the visible coordinate HUD.
 *
 * The text shapes are a QA-harness contract (`scripts/qa_runner.py` greps for `meshes` and
 * `#<id>`), so they live in one place and the component only renders them.
 */

export interface CoordinateReadoutInput {
  selectedExpressID: number | null;
  transformInfo: { position: [number, number, number]; rotation: [number, number, number] } | null;
  elementCount: number;
}

export interface CoordinateReadout {
  meshText: string;
  positionText: string;
  fullText: string;
}

/**
 * Signed metres with exactly three decimals: `+1.235m`, `-2.100m`, `+0.000m`.
 *
 * Anything whose magnitude rounds to zero renders as `+0.000m` - never `-0.000m`, so the
 * readout does not flicker through a phantom minus sign while dragging across the origin.
 */
export function formatCoordinate(value: number): string {
  const rounded = Number(value.toFixed(3));
  if (!Number.isFinite(rounded) || rounded === 0) return '+0.000m';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(3)}m`;
}

export function buildCoordinateReadout(input: CoordinateReadoutInput): CoordinateReadout {
  const meshText = `${input.elementCount} meshes`;
  if (input.selectedExpressID === null) {
    return { meshText, positionText: '', fullText: meshText };
  }

  const position = input.transformInfo?.position ?? [0, 0, 0];
  const positionText =
    `#${input.selectedExpressID} X ${formatCoordinate(position[0])} ` +
    `Y ${formatCoordinate(position[1])} Z ${formatCoordinate(position[2])}`;

  return { meshText, positionText, fullText: `${meshText} ${positionText}` };
}

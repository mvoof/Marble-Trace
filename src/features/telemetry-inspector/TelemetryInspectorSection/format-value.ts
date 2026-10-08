import type { InspectorRow } from '@features/telemetry-inspector/inspector';

/**
 * Decimals shown for a float. Four, so the quantization applied on publication
 * is visible here rather than hidden by the display.
 */
const DECIMALS = 4;

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(DECIMALS);

/**
 * What a row shows in its value column.
 *
 * A branch shows a summary, never its contents: the contents are the rows
 * underneath it once it is opened, and printing them here as well is what made
 * per-car arrays unreadable — sixty-three numbers elided behind an ellipsis
 * answer nothing.
 *
 * `exact` prints a number as it arrived, for the sim's own data: rounding it
 * for display would be processing too.
 */
export const formatInspectorValue = (
  row: InspectorRow,
  exact: boolean
): string => {
  if (row.kind === 'array') {
    return `[${row.length ?? 0}]`;
  }

  if (row.kind === 'object') {
    return `{${Object.keys(row.value as object).length}}`;
  }

  if (row.kind === 'number') {
    return exact ? String(row.value) : formatNumber(row.value as number);
  }

  return String(row.value);
};

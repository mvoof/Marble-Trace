import type { CarStatusFrame } from '@/types/bindings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';

/** How a value is turned into the string the cell draws. */
type CellFormat = 'integer' | 'oneDecimal' | 'signedOneDecimal';

/**
 * What colour the cell flashes when the driver moves it.
 *
 * The groups are what the hands reach for together: three brake cells and three
 * differential cells. A shared colour says which system moved without the
 * driver reading a label, which is the whole point of a flash seen in
 * peripheral vision.
 */
export type CellFlashTone = 'neutral' | 'brake' | 'diff';

/**
 * An in-car adjustment cell: one toggle, one field, one format.
 *
 * These are listed rather than written out as markup because every one of them
 * is the same shape, and because the layout resolver has to count them from the
 * settings alone — a list both the component and the manifest read keeps the two
 * counts from drifting apart.
 */
export interface AdjustmentCellSpec {
  settingKey: keyof EnginePanelWidgetSettings;
  field: keyof CarStatusFrame;
  label: string;
  format: CellFormat;
  unit?: string;
  /** Painted in the accent blue, the way TC already is. */
  accent?: boolean;
  /** Defaults to `neutral`. */
  flashTone?: CellFlashTone;
}

/**
 * The brake cells carry `BIAS` and the differential cells carry `DIFF`, so a
 * driver scanning the panel groups them by reading rather than by remembering
 * which of FINE, PEAK, ENTRY, MID and HISPD belong to what. The coarse brake
 * bias is already `BIAS`, which is the group's own name.
 *
 * `dcDiffExit` is labelled `HISPD`, which is what the formula cars call it in
 * their own in-car adjustments box. The SDK name says Exit and some cars agree,
 * but the cars that expose three differentials at all are the formula cars, so
 * their word is the one the driver is looking for.
 */
export const ADJUSTMENT_CELLS: readonly AdjustmentCellSpec[] = [
  {
    settingKey: 'showTc',
    field: 'dc_traction_control',
    label: 'TC',
    format: 'integer',
    accent: true,
  },
  {
    settingKey: 'showTc2',
    field: 'dc_traction_control_2',
    label: 'TC2',
    format: 'integer',
    accent: true,
  },
  {
    settingKey: 'showEngineMap',
    field: 'dc_throttle_shape',
    label: 'MAP',
    format: 'integer',
  },
  {
    settingKey: 'showEngineBraking',
    field: 'dc_engine_braking',
    label: 'EB',
    format: 'integer',
  },
  {
    settingKey: 'showBrakeBias',
    flashTone: 'brake',
    field: 'dc_brake_bias',
    label: 'BIAS',
    format: 'oneDecimal',
    unit: '%',
  },
  {
    settingKey: 'showBrakeBiasFine',
    flashTone: 'brake',
    field: 'dc_brake_bias_fine',
    label: 'BIAS FINE',
    format: 'signedOneDecimal',
  },
  {
    settingKey: 'showPeakBrakeBias',
    flashTone: 'brake',
    field: 'dc_peak_brake_bias',
    label: 'BIAS PEAK',
    format: 'oneDecimal',
  },
  {
    settingKey: 'showDiffEntry',
    flashTone: 'diff',
    field: 'dc_diff_entry',
    label: 'DIFF ENTRY',
    format: 'integer',
  },
  {
    settingKey: 'showDiffMiddle',
    flashTone: 'diff',
    field: 'dc_diff_middle',
    label: 'DIFF MID',
    format: 'integer',
  },
  {
    settingKey: 'showDiffExit',
    flashTone: 'diff',
    field: 'dc_diff_exit',
    label: 'DIFF HISPD',
    format: 'integer',
  },
];

export const formatAdjustment = (value: number, format: CellFormat): string => {
  if (format === 'integer') {
    return Math.round(value).toString();
  }

  if (format === 'signedOneDecimal') {
    return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
  }

  return value.toFixed(1);
};

/**
 * Split `count` cells into rows of at most `maxCols`, as evenly as the count
 * allows.
 *
 * A grid that fills the first row and leaves one cell alone on the second reads
 * as a broken widget rather than as a second row. Balancing the rows and letting
 * each one stretch to the full width removes that tail for any cell count — and
 * it is the cell count that moves here, since the panel carries what the car
 * declares rather than a fixed set.
 */
export const balanceCellRows = (count: number, maxCols: number): number[] => {
  if (count <= 0) {
    return [];
  }

  const columns = Math.max(1, Math.floor(maxCols));
  const rows = Math.max(1, Math.ceil(count / columns));
  const base = Math.floor(count / rows);
  const remainder = count % rows;

  return Array.from({ length: rows }, (_unused, row) =>
    row < remainder ? base + 1 : base
  );
};

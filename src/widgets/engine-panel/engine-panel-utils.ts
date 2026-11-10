import type { CarStatusFrame } from '@shared/contracts/generated/bindings';
import type { EnginePanelWidgetSettings } from './settings-schema';

/** How a value is turned into the string the cell draws. */
type CellFormat =
  | 'integer'
  | 'oneDecimal'
  | 'twoDecimal'
  | 'signedOneDecimal'
  | 'signedTwoDecimal';

/**
 * The strip a cell sits on. The panel is one fixed stack of strips, so a value
 * is found in the same place in every car:
 *
 * - `brake` — the bias and the spare brake rotary (the GTP's migration);
 * - `traction` — traction control, ABS and the engine map: what a GT3 and a GTP
 *   both carry, so the strip reads the same in either;
 * - `trim` — what only the GTP and the formula cars expose on top of that: the
 *   second traction channel, engine braking, the peak and fine bias;
 * - `diff` — the formula cars' three differentials;
 * - `chassis` — the GTP's anti-roll bars;
 * - `engine` — the liquids and the battery, always at the bottom.
 *
 * A car without a strip's controls simply has no strip; the others keep their
 * order. The strip's tone is a marker at its edge and the color a cell lights
 * in when its knob moves, never the values'.
 */
export type CellGroup =
  | 'brake'
  | 'traction'
  | 'trim'
  | 'diff'
  | 'chassis'
  | 'engine';

/** The order the strips are always drawn in, top to bottom. */
export const GROUP_ORDER: readonly CellGroup[] = [
  'brake',
  'traction',
  'trim',
  'diff',
  'chassis',
  'engine',
];

/**
 * Strip heights, in design px, the rule above the strip included: the brake
 * strip holds the bias at headline size, the traction strip its larger chips,
 * the engine readings sit tightest.
 */
export const STRIP_HEIGHTS: Record<CellGroup, number> = {
  brake: 36,
  traction: 32,
  trim: 30,
  diff: 30,
  chassis: 30,
  engine: 28,
};

/** The panel's full width in design px, cut into twelve columns. */
export const PANEL_COLUMNS = 12;
export const COLUMN_WIDTH = 332 / PANEL_COLUMNS;

/**
 * An in-car adjustment cell: one field, one label, one format.
 *
 * Placement is not here — it lives in `CELL_SLOTS`, the one ordered list both
 * the widget and the manifest's layout resolver read. Two lists of the same
 * cells drift; one list cannot.
 */
export interface AdjustmentCellSpec {
  field: keyof CarStatusFrame;
  label: string;
  format: CellFormat;
  unit?: string;
}

/**
 * Labels are short because the strip already says the rest. Three cells reading
 * `DIFF ENTRY`, `DIFF MID` and `DIFF HISPD` spend the whole cell width on a word
 * stated once — the first cell of the differential strip carries `DIFF`, the
 * other two are `MID` and `HSP`.
 *
 * `HSP` is high speed, which is what the formula cars call this differential in
 * their own in-car adjustments box. The SDK name says Exit and some cars agree,
 * but the cars exposing three differentials at all are the formula cars, so
 * their word is the one the driver is looking for.
 */
export const ADJUSTMENT_SPECS = {
  showBrakeBias: {
    field: 'dc_brake_bias',
    label: 'BIAS',
    format: 'twoDecimal',
    unit: '%',
  },
  showBrakeBiasFine: {
    field: 'dc_brake_bias_fine',
    label: 'FINE',
    format: 'signedTwoDecimal',
  },
  showPeakBrakeBias: {
    field: 'dc_peak_brake_bias',
    label: 'PEAK',
    format: 'twoDecimal',
  },
  showTc: {
    field: 'dc_traction_control',
    label: 'TC',
    format: 'integer',
  },
  showTc2: {
    field: 'dc_traction_control_2',
    label: 'TC2',
    format: 'integer',
  },
  showEngineBraking: {
    field: 'dc_engine_braking',
    label: 'EB',
    format: 'integer',
  },
  showEngineMap: {
    field: 'dc_throttle_shape',
    label: 'MAP',
    format: 'integer',
  },
  showDiffEntry: {
    field: 'dc_diff_entry',
    label: 'DIFF ENT',
    format: 'integer',
  },
  showDiffMiddle: {
    field: 'dc_diff_middle',
    label: 'MID',
    format: 'integer',
  },
  showDiffExit: {
    field: 'dc_diff_exit',
    label: 'HSP',
    format: 'integer',
  },
  showAntiRollFront: {
    field: 'dc_anti_roll_front',
    label: 'FARB',
    format: 'integer',
  },
  showAntiRollRear: {
    field: 'dc_anti_roll_rear',
    label: 'RARB',
    format: 'integer',
  },
  // The car's spare brake rotary. On the hybrid prototypes it is the brake bias
  // migration, on another car it is whatever that car put there — the slot has
  // no fixed meaning and iRacing's own description of it ("In car brake misc
  // adjustment") is the same generic string on every car, so the label cannot
  // be read from telemetry. Until a per-car table exists it is labelled for
  // what the SDK calls it, and it is signed because a migration gain is.
  showBrakeMisc: {
    field: 'dc_brake_misc',
    label: 'B MISC',
    format: 'signedTwoDecimal',
  },
} as const satisfies Record<string, AdjustmentCellSpec>;

export type AdjustmentKey = keyof typeof ADJUSTMENT_SPECS;

/**
 * The cells that are not a plain adjustment read: ABS has its own component
 * because its light lives in the 60 Hz frame, and the two temperatures share
 * one cell — they are read together and they move slowly.
 */
export type SpecialCellId = 'abs' | 'temps' | 'oilPress' | 'voltage';

export type CellId = AdjustmentKey | SpecialCellId;

/**
 * Every cell the panel can draw, in the order it is always drawn.
 *
 * One ordered list is the point. The widget walks it to place the nodes it
 * built, and the manifest's resolver walks it to size the widget from the
 * settings alone — so the shape the resolver measures is the shape the widget
 * renders.
 */
export interface CellSlot {
  id: CellId;
  group: CellGroup;
  /** The panel's headline figure, drawn large and unframed: the brake bias. */
  lead?: boolean;
  /**
   * The columns, of twelve, the cell takes. A strip shares its width in
   * proportion to these, and the widest strip is the panel's width — a strip
   * of fewer columns stretches its cells to fill it.
   */
  columns: number;
  /** The cell is drawn while any of these is on. */
  settingKeys: readonly (keyof EnginePanelWidgetSettings)[];
}

export const CELL_SLOTS: readonly CellSlot[] = [
  {
    id: 'showBrakeBias',
    group: 'brake',
    lead: true,
    columns: 7,
    settingKeys: ['showBrakeBias'],
  },
  {
    id: 'showBrakeMisc',
    group: 'brake',
    columns: 5,
    settingKeys: ['showBrakeMisc'],
  },

  {
    id: 'showTc',
    group: 'traction',

    columns: 4,
    settingKeys: ['showTc'],
  },
  {
    id: 'abs',
    group: 'traction',

    columns: 4,
    settingKeys: ['showAbs'],
  },
  {
    id: 'showEngineMap',
    group: 'traction',

    columns: 4,
    settingKeys: ['showEngineMap'],
  },

  { id: 'showTc2', group: 'trim', columns: 2, settingKeys: ['showTc2'] },
  {
    id: 'showEngineBraking',
    group: 'trim',
    columns: 2,
    settingKeys: ['showEngineBraking'],
  },
  {
    id: 'showPeakBrakeBias',
    group: 'trim',
    columns: 4,
    settingKeys: ['showPeakBrakeBias'],
  },
  {
    id: 'showBrakeBiasFine',
    group: 'trim',
    columns: 4,
    settingKeys: ['showBrakeBiasFine'],
  },

  {
    id: 'showDiffEntry',
    group: 'diff',
    columns: 5,
    settingKeys: ['showDiffEntry'],
  },
  {
    id: 'showDiffMiddle',
    group: 'diff',
    columns: 3,
    settingKeys: ['showDiffMiddle'],
  },
  {
    id: 'showDiffExit',
    group: 'diff',
    columns: 4,
    settingKeys: ['showDiffExit'],
  },

  {
    id: 'showAntiRollFront',
    group: 'chassis',
    columns: 6,
    settingKeys: ['showAntiRollFront'],
  },
  {
    id: 'showAntiRollRear',
    group: 'chassis',
    columns: 6,
    settingKeys: ['showAntiRollRear'],
  },

  {
    id: 'temps',
    group: 'engine',
    columns: 5,
    settingKeys: ['showOilTemp', 'showWaterTemp'],
  },
  {
    id: 'oilPress',
    group: 'engine',
    columns: 4,
    settingKeys: ['showOilPress'],
  },
  {
    id: 'voltage',
    group: 'engine',
    columns: 3,
    settingKeys: ['showVoltage'],
  },
];

/** Which adjustment fields the change highlight watches. */
export const ADJUSTMENT_FIELDS: readonly (keyof CarStatusFrame)[] =
  Object.values(ADJUSTMENT_SPECS).map((spec) => spec.field);

/**
 * Every adjustment reads back on a fixed grid of digits, so a traction control
 * going from 9 to 10 does not push its neighbours sideways. The string length
 * is held too — a value the driver reads at the apex is read by shape.
 *
 * The brake family carries two decimals rather than one because the hybrid
 * prototypes move it in quarter points: a bias of 53.25 drawn to one decimal
 * reads 53.3, and a migration gain of −0.75 reads −0.8. A rounded adjustment is
 * worse than no adjustment — the driver checks the cell precisely when they
 * need to know which click they are on.
 */
export const formatAdjustment = (value: number, format: CellFormat): string => {
  if (format === 'integer') {
    return Math.round(value).toString();
  }

  const signed = format.startsWith('signed');
  const decimals =
    format === 'twoDecimal' || format === 'signedTwoDecimal' ? 2 : 1;

  if (signed) {
    return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(decimals)}`;
  }

  return value.toFixed(decimals);
};

/** One strip as it is drawn: its cells, in order, and the columns they take. */
export interface PlannedStrip {
  group: CellGroup;
  cells: CellSlot[];
  columns: number;
}

/** The strips the drawn cells make, in the fixed order, empty ones left out. */
export const planEnginePanel = (cells: readonly CellSlot[]): PlannedStrip[] =>
  GROUP_ORDER.flatMap((group) => {
    const members = cells.filter((cell) => cell.group === group);

    if (members.length === 0) {
      return [];
    }

    return [
      {
        group,
        cells: members,
        columns: members.reduce((total, cell) => total + cell.columns, 0),
      },
    ];
  });

/** One strip's height in design px. */
export const stripHeight = (strip: PlannedStrip): number =>
  STRIP_HEIGHTS[strip.group];

/** The height the panel draws at. */
export const panelHeight = (strips: readonly PlannedStrip[]): number =>
  strips.length === 0
    ? STRIP_HEIGHTS.engine
    : strips.reduce((total, strip) => total + stripHeight(strip), 0);

/** The fewest columns the panel takes, so a lone cell is not a sliver. */
export const MIN_COLUMNS = 6;

/** The width the panel draws at, in design px: its widest strip's. */
export const panelWidth = (strips: readonly PlannedStrip[]): number =>
  Math.max(MIN_COLUMNS, ...strips.map((strip) => strip.columns)) * COLUMN_WIDTH;

/** What a cell is called, for anything drawing the panel without telemetry. */
export const CELL_LABELS: Record<CellId, string> = {
  showBrakeBias: ADJUSTMENT_SPECS.showBrakeBias.label,
  showBrakeBiasFine: ADJUSTMENT_SPECS.showBrakeBiasFine.label,
  showPeakBrakeBias: ADJUSTMENT_SPECS.showPeakBrakeBias.label,
  showTc: ADJUSTMENT_SPECS.showTc.label,
  showTc2: ADJUSTMENT_SPECS.showTc2.label,
  showEngineBraking: ADJUSTMENT_SPECS.showEngineBraking.label,
  showEngineMap: ADJUSTMENT_SPECS.showEngineMap.label,
  showDiffEntry: ADJUSTMENT_SPECS.showDiffEntry.label,
  showDiffMiddle: ADJUSTMENT_SPECS.showDiffMiddle.label,
  showDiffExit: ADJUSTMENT_SPECS.showDiffExit.label,
  showAntiRollFront: ADJUSTMENT_SPECS.showAntiRollFront.label,
  showAntiRollRear: ADJUSTMENT_SPECS.showAntiRollRear.label,
  showBrakeMisc: ADJUSTMENT_SPECS.showBrakeMisc.label,
  abs: 'ABS',
  temps: 'OIL / W',
  oilPress: 'OIL P',
  voltage: 'VOLT',
};

/** The settings that add or remove a cell — every `show*` key, and only those. */
export type CellSettingKey = Extract<
  keyof EnginePanelWidgetSettings,
  `show${string}`
>;

export const CELL_SETTING_KEYS = Array.from(
  new Set(CELL_SLOTS.flatMap((slot) => slot.settingKeys))
) as CellSettingKey[];

/**
 * The cells a settings blob asks for.
 *
 * Whether the car publishes the field is not known here and is not meant to be:
 * the resolver sizes the widget from the user's choices, so a car exposing
 * fewer adjustments leaves the panel with spare room rather than resizing it
 * every time a session changes.
 */
export const enabledCellSlots = (
  settings: Partial<Record<keyof EnginePanelWidgetSettings, unknown>>
): CellSlot[] =>
  CELL_SLOTS.filter((slot) =>
    slot.settingKeys.some((key) => settings[key] !== false)
  );

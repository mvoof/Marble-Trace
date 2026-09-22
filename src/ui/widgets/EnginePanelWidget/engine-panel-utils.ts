import type { CarStatusFrame } from '@/types/bindings';
import type { EnginePanelWidgetSettings } from '@/types/widget-settings';

/** How a value is turned into the string the cell draws. */
type CellFormat =
  | 'integer'
  | 'oneDecimal'
  | 'twoDecimal'
  | 'signedOneDecimal'
  | 'signedTwoDecimal';

/**
 * Which system a cell belongs to.
 *
 * The group is what carries the layout: cells of one group sit together in one
 * plate, and the plates are separated by a gap rather than by a hairline. A gap
 * is what the eye reads as a break — fifteen cells behind identical dividers
 * read as one run, which is why a value took so long to find.
 *
 * The group's colour is a two-pixel edge on top of the plate, nothing more. It
 * confirms a boundary the gap already drew; it never carries the meaning on its
 * own. An overlay lies over a moving track, and the saturated colours are
 * already spoken for — blue is traction control, amber an active ABS, red a
 * temperature over the line.
 */
export type CellGroup = 'brake' | 'traction' | 'diff' | 'chassis' | 'engine';

/**
 * How much of the group's width and type size a cell gets.
 *
 * `lead` is what the hands move mid-corner and the eye picks up without
 * reading: brake bias, traction control, ABS, engine map. `satellite` is the
 * trim beside it — the fine bias, the peak, the second traction channel — still
 * on screen, but not competing for the glance.
 */
export type CellWeight = 'lead' | 'satellite';

/** The order the groups are always drawn in, whatever the car publishes. */
export const GROUP_ORDER: readonly CellGroup[] = [
  'brake',
  'traction',
  'diff',
  'chassis',
  'engine',
];

/** A lead cell is twice a satellite's width; a stack of satellites is one. */
export const LEAD_UNITS = 2;
export const SATELLITE_UNITS = 1;

/** At most two satellites share one stacked column. */
export const MAX_STACK = 2;

/**
 * Design px per width unit. A unit is one satellite column wide, and the ten
 * units of a full formula car are the widget's shipped width.
 */
export const UNIT_WIDTH = 62.5;

/**
 * Row heights, in design px. A row carrying a lead cell is taller than one of
 * plain cells — the differential and the engine readings do not need the height
 * a 22 px value does, and giving it to them was height the driver paid for
 * nothing.
 */
export const ROW_HEIGHT_LEAD = 64;
export const ROW_HEIGHT_PLAIN = 48;

/** The gap between rows and the panel's own inset, in design px. */
export const ROW_GAP = 4;
export const PANEL_PADDING = 4;

/** The height the panel draws at, gaps and inset included. */
export const panelHeight = (rows: readonly PlannedGroup[][]): number => {
  if (rows.length === 0) {
    return ROW_HEIGHT_PLAIN + PANEL_PADDING * 2;
  }

  const content = rows.reduce(
    (total, row) =>
      total +
      (row.some((group) => group.slots.some((slot) => slot.kind === 'lead'))
        ? ROW_HEIGHT_LEAD
        : ROW_HEIGHT_PLAIN),
    0
  );

  return content + (rows.length - 1) * ROW_GAP + PANEL_PADDING * 2;
};

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
  /** Painted in the accent blue, the way TC already is. */
  accent?: boolean;
}

/**
 * Labels are short because the plate already says the rest. Three cells reading
 * `DIFF ENTRY`, `DIFF MID` and `DIFF HISPD` spend the whole cell width on a word
 * stated once — the first cell of the differential plate carries `DIFF`, the
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
    accent: true,
  },
  showTc2: {
    field: 'dc_traction_control_2',
    label: 'TC2',
    format: 'integer',
    accent: true,
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
 * one cell — they are read together and they move slowly, so two plates for
 * them were two plates the eye had to cross.
 */
export type SpecialCellId = 'abs' | 'temps' | 'oilPress' | 'voltage';

export type CellId = AdjustmentKey | SpecialCellId;

/**
 * Every cell the panel can draw, in the order it is always drawn.
 *
 * One ordered list is the point. The widget walks it to place the nodes it
 * built, and the manifest's resolver walks it to size the widget from the
 * settings alone — so the shape the resolver measures is the shape the widget
 * renders. It is also what makes the panel findable across cars: the groups
 * keep their order whatever a car leaves out, so brake bias sits in the same
 * corner in a formula car and in a GT3.
 */
export interface CellSlot {
  id: CellId;
  group: CellGroup;
  weight: CellWeight;
  /** The cell is drawn while any of these is on. */
  settingKeys: readonly (keyof EnginePanelWidgetSettings)[];
}

export const CELL_SLOTS: readonly CellSlot[] = [
  {
    id: 'showBrakeBias',
    group: 'brake',
    weight: 'lead',
    settingKeys: ['showBrakeBias'],
  },
  {
    id: 'showBrakeBiasFine',
    group: 'brake',
    weight: 'satellite',
    settingKeys: ['showBrakeBiasFine'],
  },
  {
    id: 'showPeakBrakeBias',
    group: 'brake',
    weight: 'satellite',
    settingKeys: ['showPeakBrakeBias'],
  },
  {
    id: 'showBrakeMisc',
    group: 'brake',
    weight: 'satellite',
    settingKeys: ['showBrakeMisc'],
  },

  { id: 'showTc', group: 'traction', weight: 'lead', settingKeys: ['showTc'] },
  {
    id: 'showTc2',
    group: 'traction',
    weight: 'satellite',
    settingKeys: ['showTc2'],
  },
  {
    id: 'showEngineBraking',
    group: 'traction',
    weight: 'satellite',
    settingKeys: ['showEngineBraking'],
  },
  { id: 'abs', group: 'traction', weight: 'lead', settingKeys: ['showAbs'] },
  {
    id: 'showEngineMap',
    group: 'traction',
    weight: 'lead',
    settingKeys: ['showEngineMap'],
  },

  {
    id: 'showDiffEntry',
    group: 'diff',
    weight: 'satellite',
    settingKeys: ['showDiffEntry'],
  },
  {
    id: 'showDiffMiddle',
    group: 'diff',
    weight: 'satellite',
    settingKeys: ['showDiffMiddle'],
  },
  {
    id: 'showDiffExit',
    group: 'diff',
    weight: 'satellite',
    settingKeys: ['showDiffExit'],
  },

  {
    id: 'showAntiRollFront',
    group: 'chassis',
    weight: 'satellite',
    settingKeys: ['showAntiRollFront'],
  },
  {
    id: 'showAntiRollRear',
    group: 'chassis',
    weight: 'satellite',
    settingKeys: ['showAntiRollRear'],
  },

  {
    id: 'temps',
    group: 'engine',
    weight: 'satellite',
    settingKeys: ['showOilTemp', 'showWaterTemp'],
  },
  {
    id: 'oilPress',
    group: 'engine',
    weight: 'satellite',
    settingKeys: ['showOilPress'],
  },
  {
    id: 'voltage',
    group: 'engine',
    weight: 'satellite',
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

/**
 * A slot as it is drawn: one lead cell, one plain cell, or a column of up to
 * two satellites standing beside a lead.
 */
export interface PlannedSlot {
  kind: 'lead' | 'plain' | 'stack';
  ids: CellId[];
  units: number;
}

export interface PlannedGroup {
  group: CellGroup;
  slots: PlannedSlot[];
  units: number;
}

/**
 * Turn one group's cells into slots.
 *
 * A satellite only shrinks into a stacked column when it stands next to a lead
 * — that is what the size difference is for. A group of nothing but satellites
 * (the differential, the engine readings) has no lead to be secondary to, so
 * every cell is drawn plain and the group reads as an even row.
 *
 * A stack of one is not a stack. On a car with a second traction channel but no
 * engine braking, TC2 would otherwise stand alone at half the height of the
 * cell beside it, reading as a scrap of a column rather than a value — so a
 * column that ends up holding one cell is drawn plain, level with the rest.
 */
export const planGroupSlots = (cells: readonly CellSlot[]): PlannedSlot[] => {
  const hasLead = cells.some((cell) => cell.weight === 'lead');
  const slots: PlannedSlot[] = [];
  let leadSeen = false;

  for (const cell of cells) {
    if (cell.weight === 'lead') {
      leadSeen = true;
      slots.push({ kind: 'lead', ids: [cell.id], units: LEAD_UNITS });

      continue;
    }

    if (!hasLead || !leadSeen) {
      slots.push({ kind: 'plain', ids: [cell.id], units: SATELLITE_UNITS });

      continue;
    }

    const last = slots[slots.length - 1];

    if (last?.kind === 'stack' && last.ids.length < MAX_STACK) {
      last.ids.push(cell.id);

      continue;
    }

    slots.push({ kind: 'stack', ids: [cell.id], units: SATELLITE_UNITS });
  }

  return slots.map((slot) =>
    slot.kind === 'stack' && slot.ids.length === 1
      ? { ...slot, kind: 'plain' as const }
      : slot
  );
};

/**
 * Break the groups into rows, never through the middle of a group.
 *
 * `maxCols` is a ceiling in width units, not a cell count: a group that fits
 * joins the row, one that does not starts the next. A single group wider than
 * the ceiling keeps its own row and draws its cells narrow rather than being
 * split — splitting it would put the differential's three cells in two places,
 * which is the thing this replaces.
 */
export const packGroups = (
  groups: readonly PlannedGroup[],
  maxCols: number
): PlannedGroup[][] => {
  const ceiling = Math.max(1, Math.floor(maxCols));
  const rows: PlannedGroup[][] = [];
  let row: PlannedGroup[] = [];
  let used = 0;

  for (const group of groups) {
    if (row.length > 0 && used + group.units > ceiling) {
      rows.push(row);
      row = [];
      used = 0;
    }

    row.push(group);
    used += group.units;
  }

  if (row.length > 0) {
    rows.push(row);
  }

  return rows;
};

/**
 * The whole layout: the cells that are drawn, grouped in the fixed order,
 * sliced into slots and packed into rows.
 */
export const planEnginePanel = (
  cells: readonly CellSlot[],
  maxCols: number
): PlannedGroup[][] => {
  const groups: PlannedGroup[] = [];

  for (const group of GROUP_ORDER) {
    const members = cells.filter((cell) => cell.group === group);

    if (members.length === 0) {
      continue;
    }

    const slots = planGroupSlots(members);

    groups.push({
      group,
      slots,
      units: slots.reduce((total, slot) => total + slot.units, 0),
    });
  }

  return packGroups(groups, maxCols);
};

/**
 * How a cell is drawn, which is the slot it landed in rather than the weight it
 * asked for. A group with no lead has nobody to be secondary to, so its cells
 * are drawn `plain` at reading size — the satellite's small type is only for a
 * cell standing two-to-a-column beside a lead.
 */
export type CellRenderWeight = 'lead' | 'plain' | 'satellite';

const SLOT_RENDER_WEIGHT: Record<PlannedSlot['kind'], CellRenderWeight> = {
  lead: 'lead',
  plain: 'plain',
  stack: 'satellite',
};

/** What each drawn cell is rendered as, read off the finished plan. */
export const renderWeights = (
  rows: readonly (readonly PlannedGroup[])[]
): Map<CellId, CellRenderWeight> => {
  const weights = new Map<CellId, CellRenderWeight>();

  for (const row of rows) {
    for (const group of row) {
      for (const slot of group.slots) {
        for (const id of slot.ids) {
          weights.set(id, SLOT_RENDER_WEIGHT[slot.kind]);
        }
      }
    }
  }

  return weights;
};

/** A row's width in units — what the design width is measured from. */
export const rowUnits = (row: readonly PlannedGroup[]): number =>
  row.reduce((total, group) => total + group.units, 0);

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
  temps: 'OIL / WATER',
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

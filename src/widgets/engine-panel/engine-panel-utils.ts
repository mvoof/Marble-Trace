import type { CarStatusFrame } from '@shared/contracts/generated/bindings';
import {
  HORIZONTAL_ROWS,
  type EnginePanelWidgetSettings,
  type HorizontalRows,
} from './settings-schema';

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

/**
 * Width units. Every horizontal cell is one column — a lead is told by its
 * larger figure, not a wider cell, so the columns of one row stand over the
 * columns of the next. The vertical tiers are each a line of their own and
 * align with nothing: there a lead takes two, a cell that reads its label and
 * value on one line two, and the temperature pair three.
 */
export const COLUMN_UNITS = 1;
export const VERTICAL_LEAD_UNITS = 2;
export const INLINE_UNITS = 2;
export const WIDE_INLINE_UNITS = 3;

/** At most two satellites share one stacked column. */
export const MAX_STACK = 2;

/**
 * Design px per width unit. A horizontal column is wide enough for a lead's
 * figure and the temperature pair; a vertical unit is narrower, since its
 * cells span two or three.
 */
export const UNIT_WIDTH = 72;
export const VERTICAL_UNIT_WIDTH = 62.5;

/** The width of one unit, in the given orientation. */
export const unitWidth = (horizontal: boolean): number =>
  horizontal ? UNIT_WIDTH : VERTICAL_UNIT_WIDTH;

/**
 * In `auto`, the systems are split over two rows, or three once two would
 * leave a row of more than this many columns.
 */
export const AUTO_ROW_UNITS = 8;

/**
 * Row heights, in design px, the rules between rows included. The horizontal
 * rows set the label over the value; a row with a lead holds its larger figure
 * or two satellites one above the other. The vertical tiers read in one line,
 * except beside a lead, where the satellites stand label over value.
 */
export const ROW_HEIGHT_LEAD = 52;
export const ROW_HEIGHT_PLAIN = 40;
export const TIER_HEIGHT_LEAD = 38;
export const TIER_HEIGHT_PLAIN = 30;

/** Whether a row or tier carries a lead cell. */
export const rowHasLead = (row: readonly PlannedGroup[]): boolean =>
  row.some((group) => group.hasLead);

/** One row's height in design px, in the given orientation. */
export const rowHeight = (
  row: readonly PlannedGroup[],
  horizontal: boolean
): number => {
  if (horizontal) {
    return rowHasLead(row) ? ROW_HEIGHT_LEAD : ROW_HEIGHT_PLAIN;
  }

  return rowHasLead(row) ? TIER_HEIGHT_LEAD : TIER_HEIGHT_PLAIN;
};

/** The height the panel draws at. */
export const panelHeight = (
  rows: readonly PlannedGroup[][],
  horizontal: boolean
): number => {
  if (rows.length === 0) {
    return horizontal ? ROW_HEIGHT_PLAIN : TIER_HEIGHT_PLAIN;
  }

  return rows.reduce((total, row) => total + rowHeight(row, horizontal), 0);
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
  /** Its value runs longer than one column holds: the temperature pair. */
  wide?: boolean;
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
    wide: true,
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
  hasLead: boolean;
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
 *
 * The vertical tiers stack nothing: a tier is one line of the panel, and two
 * satellites one above the other would make it two. A tier with no lead reads
 * each cell's label and value on one line, which takes the wider share.
 */
export const planGroupSlots = (
  cells: readonly CellSlot[],
  horizontal = true
): PlannedSlot[] => {
  const hasLead = cells.some((cell) => cell.weight === 'lead');
  const slots: PlannedSlot[] = [];
  let leadSeen = false;

  const plainUnits = (cell: CellSlot): number => {
    if (!horizontal && !hasLead) {
      return cell.wide ? WIDE_INLINE_UNITS : INLINE_UNITS;
    }

    return COLUMN_UNITS;
  };

  const leadUnits = horizontal ? COLUMN_UNITS : VERTICAL_LEAD_UNITS;

  for (const cell of cells) {
    if (cell.weight === 'lead') {
      leadSeen = true;
      slots.push({ kind: 'lead', ids: [cell.id], units: leadUnits });

      continue;
    }

    if (!horizontal || !hasLead || !leadSeen) {
      slots.push({ kind: 'plain', ids: [cell.id], units: plainUnits(cell) });

      continue;
    }

    const last = slots[slots.length - 1];

    if (last?.kind === 'stack' && last.ids.length < MAX_STACK) {
      last.ids.push(cell.id);

      continue;
    }

    slots.push({ kind: 'stack', ids: [cell.id], units: COLUMN_UNITS });
  }

  return slots.map((slot) =>
    slot.kind === 'stack' && slot.ids.length === 1
      ? { ...slot, kind: 'plain' as const }
      : slot
  );
};

/** The groups' total width, in units. */
const unitsOf = (groups: readonly PlannedGroup[]): number =>
  groups.reduce((total, group) => total + group.units, 0);

/**
 * Split the groups, in order, into `rowCount` rows as even in width as they
 * can be — never through the middle of a group.
 *
 * Rows are not stretched to one width — a short row ends early, so its columns
 * stay over the columns below — and an even split keeps that ragged edge
 * short. The narrowest widest row wins; between equals, the earlier rows take
 * more, so the systems the hands move sit in the first row.
 */
export const splitGroups = (
  groups: readonly PlannedGroup[],
  rowCount: number
): PlannedGroup[][] => {
  const count = Math.max(1, Math.min(rowCount, groups.length));

  if (count === 1) {
    return groups.length === 0 ? [] : [[...groups]];
  }

  let best: PlannedGroup[][] = [];
  let bestWidest = Infinity;

  // The first row takes `take` groups, the rest are split the same way. Five
  // groups into three rows is a handful of tries.
  for (let take = groups.length - count + 1; take >= 1; take -= 1) {
    const head = groups.slice(0, take);
    const tail = splitGroups(groups.slice(take), count - 1);
    const widest = Math.max(unitsOf(head), ...tail.map(unitsOf));

    if (widest < bestWidest) {
      best = [head, ...tail];
      bestWidest = widest;
    }
  }

  return best;
};

/**
 * The rows `auto` asks for: two, or three once two would leave a row longer
 * than `AUTO_ROW_UNITS`. One long strip reads worse than a block at any count.
 */
export const autoRowCount = (groups: readonly PlannedGroup[]): number => {
  const widestOfTwo = Math.max(0, ...splitGroups(groups, 2).map(unitsOf));

  return widestOfTwo > AUTO_ROW_UNITS ? 3 : 2;
};

/** How the settings lay the panel out. */
export interface PanelLayout {
  horizontal: boolean;
  rows: HorizontalRows;
}

/** The layout a settings blob asks for, an unknown row count read as `auto`. */
export const panelLayoutOf = (
  settings: Partial<Record<keyof EnginePanelWidgetSettings, unknown>>
): PanelLayout => {
  const rows = HORIZONTAL_ROWS.find(
    (option) => option === settings.horizontalRows
  );

  return {
    horizontal: settings.horizontal !== false,
    rows: rows ?? 'auto',
  };
};

/**
 * The whole layout: the cells that are drawn, grouped in the fixed order,
 * sliced into slots and laid into rows — one tier per group when vertical,
 * balanced rows when horizontal.
 */
export const planEnginePanel = (
  cells: readonly CellSlot[],
  layout: PanelLayout
): PlannedGroup[][] => {
  const groups: PlannedGroup[] = [];

  for (const group of GROUP_ORDER) {
    const members = cells.filter((cell) => cell.group === group);

    if (members.length === 0) {
      continue;
    }

    const slots = planGroupSlots(members, layout.horizontal);

    groups.push({
      group,
      slots,
      units: slots.reduce((total, slot) => total + slot.units, 0),
      hasLead: slots.some((slot) => slot.kind === 'lead'),
    });
  }

  if (!layout.horizontal) {
    return groups.map((group) => [group]);
  }

  const rowCount = layout.rows === 'auto' ? autoRowCount(groups) : layout.rows;

  return splitGroups(groups, rowCount);
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

/**
 * How a cell is drawn: its weight, and whether its label and value share one
 * line. The vertical tiers read in one line — a lead beside its satellites,
 * and every cell of a tier with no lead; the satellites beside a lead stand
 * label over value, as every cell of the horizontal rows does.
 */
export interface CellRender {
  weight: CellRenderWeight;
  inline: boolean;
}

/** What each drawn cell is rendered as, read off the finished plan. */
export const renderCells = (
  rows: readonly (readonly PlannedGroup[])[],
  horizontal: boolean
): Map<CellId, CellRender> => {
  const renders = new Map<CellId, CellRender>();

  for (const row of rows) {
    for (const group of row) {
      for (const slot of group.slots) {
        const inline = !horizontal && (slot.kind === 'lead' || !group.hasLead);

        for (const id of slot.ids) {
          renders.set(id, { weight: SLOT_RENDER_WEIGHT[slot.kind], inline });
        }
      }
    }
  }

  return renders;
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

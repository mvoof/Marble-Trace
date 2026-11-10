import { describe, expect, it } from 'vitest';

import { ENGINE_PANEL_MANIFEST } from './manifest';
import {
  CELL_SLOTS,
  UNIT_WIDTH,
  enabledCellSlots,
  formatAdjustment,
  panelHeight,
  panelLayoutOf,
  planEnginePanel,
  planGroupSlots,
  renderCells,
  rowUnits,
  splitGroups,
  type CellSlot,
  type PlannedGroup,
} from './engine-panel-utils';
import type { EnginePanelWidgetSettings } from './settings-schema';

const slotsOf = (group: CellSlot['group']) =>
  CELL_SLOTS.filter((slot) => slot.group === group);

const shipped =
  ENGINE_PANEL_MANIFEST.userSettings as unknown as EnginePanelWidgetSettings;

const stubGroup = (group: PlannedGroup['group'], units: number) =>
  ({ group, slots: [], units, hasLead: false }) as PlannedGroup;

const groupsOf = (rows: PlannedGroup[][]) =>
  rows.map((row) => row.map((group) => group.group));

const AUTO = { horizontal: true, rows: 'auto' } as const;
const VERTICAL = { horizontal: false, rows: 'auto' } as const;

describe('planGroupSlots', () => {
  it('stands the satellites beside their lead', () => {
    const slots = planGroupSlots(slotsOf('brake'));

    expect(slots).toEqual([
      { kind: 'lead', ids: ['showBrakeBias'], units: 2 },
      {
        kind: 'stack',
        ids: ['showBrakeBiasFine', 'showPeakBrakeBias'],
        units: 1,
      },
      // The third satellite starts a column of its own, and a column of one is
      // drawn level with the rest.
      { kind: 'plain', ids: ['showBrakeMisc'], units: 1 },
    ]);
  });

  it('draws a group with no lead as an even row', () => {
    const slots = planGroupSlots(slotsOf('diff'));

    expect(slots.map((slot) => slot.kind)).toEqual(['plain', 'plain', 'plain']);
  });

  it('draws a lone satellite level with the rest instead of half a column', () => {
    const [lead, satellite] = slotsOf('traction');

    const slots = planGroupSlots([lead, satellite]);

    expect(slots.map((slot) => slot.kind)).toEqual(['lead', 'plain']);
  });

  it('never puts more than two satellites in one stack', () => {
    const lead = slotsOf('traction')[0];
    const satellite = slotsOf('traction')[1];

    const slots = planGroupSlots([lead, satellite, satellite, satellite]);

    expect(slots.map((slot) => slot.ids.length)).toEqual([1, 2, 1]);
    expect(slots.map((slot) => slot.kind)).toEqual(['lead', 'stack', 'plain']);
  });
});

describe('splitGroups', () => {
  it('breaks between groups, never through one', () => {
    const rows = splitGroups(
      [stubGroup('brake', 4), stubGroup('traction', 7), stubGroup('diff', 3)],
      2
    );

    expect(groupsOf(rows)).toEqual([['brake'], ['traction', 'diff']]);
  });

  it('balances the rows rather than filling the first', () => {
    const rows = splitGroups(
      [
        stubGroup('brake', 4),
        stubGroup('traction', 7),
        stubGroup('diff', 3),
        stubGroup('chassis', 2),
        stubGroup('engine', 4),
      ],
      2
    );

    expect(groupsOf(rows)).toEqual([
      ['brake', 'traction'],
      ['diff', 'chassis', 'engine'],
    ]);
  });

  it('never makes more rows than there are groups', () => {
    expect(splitGroups([stubGroup('traction', 7)], 3)).toHaveLength(1);
  });
});

describe('planEnginePanel', () => {
  it('lays a full formula car out in two balanced rows on auto', () => {
    expect(groupsOf(planEnginePanel(CELL_SLOTS, AUTO))).toEqual([
      ['brake', 'traction'],
      ['diff', 'chassis', 'engine'],
    ]);
  });

  it('keeps brake bias, TC and ABS on one row on auto', () => {
    const cells = CELL_SLOTS.filter((slot) =>
      ['showBrakeBias', 'showTc', 'abs'].includes(slot.id)
    );

    expect(groupsOf(planEnginePanel(cells, AUTO))).toEqual([
      ['brake', 'traction'],
    ]);
  });

  it('keeps the groups in their fixed order whatever the car leaves out', () => {
    const gt3 = CELL_SLOTS.filter(
      (slot) => slot.group !== 'diff' && slot.id !== 'showTc2'
    );

    const rows = planEnginePanel(gt3, AUTO);

    expect(rows[0].map((group) => group.group)).toEqual(['brake', 'traction']);
  });

  it('gives every group its own tier when vertical', () => {
    expect(groupsOf(planEnginePanel(CELL_SLOTS, VERTICAL))).toEqual([
      ['brake'],
      ['traction'],
      ['diff'],
      ['chassis'],
      ['engine'],
    ]);
  });

  it('stacks nothing in a vertical tier', () => {
    const rows = planEnginePanel(CELL_SLOTS, VERTICAL);

    expect(
      rows.flat().flatMap((group) => group.slots.map((slot) => slot.kind))
    ).not.toContain('stack');
  });

  it('reads a vertical lead, and a tier with no lead, in one line', () => {
    const rows = planEnginePanel(CELL_SLOTS, VERTICAL);
    const renders = renderCells(rows, false);

    expect(renders.get('showBrakeBias')?.inline).toBe(true);
    expect(renders.get('showBrakeBiasFine')?.inline).toBe(false);
    expect(renders.get('showAntiRollFront')?.inline).toBe(true);
  });

  it('sizes the shipped manifest', () => {
    const layout = panelLayoutOf(shipped);
    const rows = planEnginePanel(enabledCellSlots(shipped), layout);

    const widest = Math.max(...rows.map(rowUnits));

    expect(widest * UNIT_WIDTH).toBe(ENGINE_PANEL_MANIFEST.designWidth);
    expect(panelHeight(rows, layout.horizontal)).toBe(
      ENGINE_PANEL_MANIFEST.designHeight
    );
  });
});

describe('design width', () => {
  const settingsWith = (patch: Partial<EnginePanelWidgetSettings>) =>
    ({ ...ENGINE_PANEL_MANIFEST.userSettings, ...patch }) as Parameters<
      NonNullable<typeof ENGINE_PANEL_MANIFEST.deriveDesignWidth>
    >[0];

  const derive = ENGINE_PANEL_MANIFEST.deriveDesignWidth!;
  const resolve = ENGINE_PANEL_MANIFEST.resolveLayoutChange!;

  it('derives the shipped width from the shipped settings', () => {
    expect(derive(settingsWith({}))).toBe(ENGINE_PANEL_MANIFEST.designWidth);
  });

  it('measures the widest row of the rows asked for', () => {
    // [brake 4] [traction 7] [diff 3, chassis 2, engine 4]
    expect(derive(settingsWith({ horizontalRows: 3 }))).toBe(9 * UNIT_WIDTH);
  });

  it('measures the widest tier when vertical', () => {
    // traction: TC 2, TC2 1, EB 1, ABS 2, MAP 2
    expect(derive(settingsWith({ horizontal: false }))).toBe(8 * UNIT_WIDTH);
  });

  it('keeps the scale when a cell is turned off', () => {
    const prev = settingsWith({});
    const next = settingsWith({ showEngineMap: false });
    const designWidth = derive(prev);

    const result = resolve(prev, next, {
      designWidth,
      designHeight: ENGINE_PANEL_MANIFEST.designHeight,
      currentWidth: designWidth * 2,
      currentHeight: ENGINE_PANEL_MANIFEST.designHeight * 2,
    });

    expect(result?.designWidth).toBe(derive(next));
    expect(result?.currentWidth).toBe(derive(next) * 2);
  });
});

// The hybrid prototypes move the brake family in quarter points, and a click
// the driver cannot read is a click they cannot trust.
describe('formatAdjustment', () => {
  it('keeps a quarter point on the brake bias', () => {
    expect(formatAdjustment(53.25, 'twoDecimal')).toBe('53.25');
  });

  it('keeps it on a negative migration gain, sign and all', () => {
    expect(formatAdjustment(-0.75, 'signedTwoDecimal')).toBe('−0.75');
  });

  it('holds the string length so the digits do not shuffle', () => {
    expect(formatAdjustment(0.5, 'signedTwoDecimal')).toHaveLength(
      formatAdjustment(-0.75, 'signedTwoDecimal').length
    );
  });

  it('leaves a rotary an integer', () => {
    expect(formatAdjustment(6, 'integer')).toBe('6');
  });
});

describe('enabledCellSlots', () => {
  it('keeps the shared temperature cell while either temperature is on', () => {
    const ids = enabledCellSlots({
      showOilTemp: false,
      showWaterTemp: true,
    }).map((slot) => slot.id);

    expect(ids).toContain('temps');
  });

  it('drops it once both are off', () => {
    const ids = enabledCellSlots({
      showOilTemp: false,
      showWaterTemp: false,
    }).map((slot) => slot.id);

    expect(ids).not.toContain('temps');
  });
});

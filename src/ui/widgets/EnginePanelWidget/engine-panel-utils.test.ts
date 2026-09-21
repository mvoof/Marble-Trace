import { describe, expect, it } from 'vitest';

import type { EnginePanelWidgetSettings } from '@/types/widget-settings';
import { ENGINE_PANEL_MANIFEST } from './manifest';
import {
  CELL_SLOTS,
  UNIT_WIDTH,
  enabledCellSlots,
  packGroups,
  panelHeight,
  planEnginePanel,
  planGroupSlots,
  rowUnits,
  type CellSlot,
  type PlannedGroup,
} from './engine-panel-utils';

const slotsOf = (group: CellSlot['group']) =>
  CELL_SLOTS.filter((slot) => slot.group === group);

const shipped =
  ENGINE_PANEL_MANIFEST.userSettings as unknown as EnginePanelWidgetSettings;

const stubGroup = (group: PlannedGroup['group'], units: number) =>
  ({ group, slots: [], units }) as PlannedGroup;

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
    ]);
  });

  it('draws a group with no lead as an even row', () => {
    const slots = planGroupSlots(slotsOf('diff'));

    expect(slots.map((slot) => slot.kind)).toEqual(['plain', 'plain', 'plain']);
  });

  it('never puts more than two satellites in one stack', () => {
    const lead = slotsOf('traction')[0];
    const satellite = slotsOf('traction')[1];

    const slots = planGroupSlots([lead, satellite, satellite, satellite]);

    expect(slots.map((slot) => slot.ids.length)).toEqual([1, 2, 1]);
  });
});

describe('packGroups', () => {
  it('breaks between groups, never through one', () => {
    const rows = packGroups(
      [stubGroup('brake', 3), stubGroup('traction', 7), stubGroup('diff', 3)],
      10
    );

    expect(rows.map((row) => row.map((group) => group.group))).toEqual([
      ['brake', 'traction'],
      ['diff'],
    ]);
  });

  it('gives a group wider than the ceiling its own row rather than splitting it', () => {
    const rows = packGroups([stubGroup('traction', 7)], 4);

    expect(rows).toHaveLength(1);
    expect(rows[0][0].units).toBe(7);
  });
});

describe('planEnginePanel', () => {
  it('lays a full formula car out in two rows at the shipped ceiling', () => {
    const rows = planEnginePanel(CELL_SLOTS, shipped.horizontalColumns);

    expect(rows.map((row) => row.map((group) => group.group))).toEqual([
      ['brake', 'traction'],
      ['diff', 'engine'],
    ]);
  });

  it('keeps the groups in their fixed order whatever the car leaves out', () => {
    const gt3 = CELL_SLOTS.filter(
      (slot) => slot.group !== 'diff' && slot.id !== 'showTc2'
    );

    const rows = planEnginePanel(gt3, 10);

    expect(rows[0].map((group) => group.group)).toEqual(['brake', 'traction']);
  });

  it('sizes the shipped manifest', () => {
    const rows = planEnginePanel(
      enabledCellSlots(shipped),
      shipped.horizontalColumns
    );

    const widest = Math.max(...rows.map(rowUnits));

    expect(widest * UNIT_WIDTH).toBe(ENGINE_PANEL_MANIFEST.designWidth);
    expect(panelHeight(rows)).toBe(ENGINE_PANEL_MANIFEST.designHeight);
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

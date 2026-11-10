import { describe, expect, it } from 'vitest';

import { ENGINE_PANEL_MANIFEST } from './manifest';
import {
  CELL_SLOTS,
  COLUMN_WIDTH,
  MIN_COLUMNS,
  enabledCellSlots,
  formatAdjustment,
  panelHeight,
  panelWidth,
  planEnginePanel,
  type CellId,
  type PlannedStrip,
} from './engine-panel-utils';
import type { EnginePanelWidgetSettings } from './settings-schema';

const shipped =
  ENGINE_PANEL_MANIFEST.userSettings as unknown as EnginePanelWidgetSettings;

const cellsOf = (ids: readonly CellId[]) =>
  CELL_SLOTS.filter((slot) => ids.includes(slot.id));

const layoutOf = (strips: PlannedStrip[]) =>
  strips.map((strip) => strip.cells.map((cell) => cell.id));

// The in-car controls each class exposes, as the preview scenarios record them.
const GT3: CellId[] = ['showBrakeBias', 'showTc', 'abs', 'showEngineMap'];
const GTP: CellId[] = [
  ...GT3,
  'showBrakeMisc',
  'showTc2',
  'showEngineBraking',
  'showPeakBrakeBias',
  'showBrakeBiasFine',
  'showAntiRollFront',
  'showAntiRollRear',
];
const FORMULA: CellId[] = [
  'showBrakeBias',
  'showTc',
  'showTc2',
  'showEngineBraking',
  'showPeakBrakeBias',
  'showBrakeBiasFine',
  'showDiffEntry',
  'showDiffMiddle',
  'showDiffExit',
];

describe('planEnginePanel', () => {
  it('draws every strip in its fixed order', () => {
    expect(planEnginePanel(CELL_SLOTS).map((strip) => strip.group)).toEqual([
      'brake',
      'traction',
      'trim',
      'diff',
      'chassis',
      'engine',
    ]);
  });

  it('gives a GT3 and a GTP the same traction strip', () => {
    const gt3 = layoutOf(planEnginePanel(cellsOf(GT3)));
    const gtp = layoutOf(planEnginePanel(cellsOf(GTP)));

    expect(gt3[1]).toEqual(['showTc', 'abs', 'showEngineMap']);
    expect(gtp[1]).toEqual(gt3[1]);
  });

  it('puts what only the GTP and the formula cars carry on one strip', () => {
    const trim = [
      'showTc2',
      'showEngineBraking',
      'showPeakBrakeBias',
      'showBrakeBiasFine',
    ];

    expect(layoutOf(planEnginePanel(cellsOf(GTP)))[2]).toEqual(trim);
    expect(layoutOf(planEnginePanel(cellsOf(FORMULA)))[2]).toEqual(trim);
  });

  it('leaves out a strip the car has nothing for', () => {
    expect(planEnginePanel(cellsOf(GT3)).map((strip) => strip.group)).toEqual([
      'brake',
      'traction',
    ]);
  });

  it('keeps the engine readings at the bottom', () => {
    const strips = planEnginePanel(CELL_SLOTS);

    expect(strips.at(-1)?.cells.map((cell) => cell.id)).toEqual([
      'temps',
      'oilPress',
      'voltage',
    ]);
  });

  it('sizes the shipped manifest', () => {
    const strips = planEnginePanel(enabledCellSlots(shipped));

    expect(panelWidth(strips)).toBe(ENGINE_PANEL_MANIFEST.designWidth);
    expect(panelHeight(strips)).toBe(ENGINE_PANEL_MANIFEST.designHeight);
  });

  it('never draws narrower than the floor', () => {
    expect(panelWidth(planEnginePanel(cellsOf(['showTc'])))).toBe(
      MIN_COLUMNS * COLUMN_WIDTH
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

  it('keeps the scale when a cell is turned off', () => {
    const prev = settingsWith({});
    const next = settingsWith({ showOilTemp: false, showWaterTemp: false });
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

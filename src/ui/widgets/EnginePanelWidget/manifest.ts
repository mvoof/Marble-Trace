import type { WidgetManifest } from '@/types/widget-settings';
import type {
  EnginePanelWidgetSettings,
  ResolveLayoutChange,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';
import { ADJUSTMENT_CELLS, balanceCellRows } from './engine-panel-utils';

/**
 * The engine-side cells, which every car has. The in-car adjustments come from
 * `ADJUSTMENT_CELLS`, so the resolver counts exactly what the widget renders.
 */
const ENGINE_CELL_KEYS = [
  'showOilTemp',
  'showWaterTemp',
  'showOilPress',
  'showVoltage',
  'showAbs',
];

const CELL_KEYS = [
  ...ENGINE_CELL_KEYS,
  ...ADJUSTMENT_CELLS.map((spec) => spec.settingKey),
];

const getCellCount = (s: any) => {
  return CELL_KEYS.filter((key) => s[key] !== false).length;
};

const resolveEnginePanelLayout: ResolveLayoutChange = (prev, next, current) => {
  const prevHorizontal = 'horizontal' in prev ? !!prev.horizontal : true;
  const nextHorizontal =
    'horizontal' in next ? !!next.horizontal : prevHorizontal;

  const prevVertCols =
    'verticalColumns' in prev ? Number(prev.verticalColumns) : 2;
  const nextVertCols =
    'verticalColumns' in next ? Number(next.verticalColumns) : prevVertCols;

  const prevHorizCols =
    'horizontalColumns' in prev ? Number(prev.horizontalColumns) : 8;
  const nextHorizCols =
    'horizontalColumns' in next
      ? Number(next.horizontalColumns)
      : prevHorizCols;

  const cellKeys = CELL_KEYS;

  const modeChanged =
    prevHorizontal !== nextHorizontal ||
    prevVertCols !== nextVertCols ||
    prevHorizCols !== nextHorizCols;

  const cellsChanged = cellKeys.some(
    (key) => (prev as any)[key] !== (next as any)[key]
  );

  if (!modeChanged && !cellsChanged) {
    return null;
  }

  const prevCells = getCellCount(prev);
  const nextCells = getCellCount(next);

  const prevCols = prevHorizontal ? prevHorizCols : prevVertCols;
  const nextCols = nextHorizontal ? nextHorizCols : nextVertCols;

  // The widget balances its rows under the column setting, so the design size
  // follows the widest row it will actually draw rather than the ceiling.
  const prevRowLengths = balanceCellRows(prevCells, prevCols);
  const nextRowLengths = balanceCellRows(nextCells, nextCols);

  const prevRows = Math.max(1, prevRowLengths.length);
  const nextRows = Math.max(1, nextRowLengths.length);

  const nextDesignWidth = Math.max(1, ...nextRowLengths) * 62.5;
  const nextDesignHeight = nextRows * 65;

  const prevSettings = prev as unknown as EnginePanelWidgetSettings;
  const prevLayoutSizes = prevSettings.layoutSizes ?? {};

  const prevModeKey = prevHorizontal
    ? `horizontal-${prevHorizCols}`
    : `vertical-${prevVertCols}`;
  const nextModeKey = nextHorizontal
    ? `horizontal-${nextHorizCols}`
    : `vertical-${nextVertCols}`;

  let savedLayoutSizes = prevLayoutSizes;
  let nextWidth = current.currentWidth;
  let nextHeight = current.currentHeight;

  if (modeChanged) {
    savedLayoutSizes = {
      ...prevLayoutSizes,
      [prevModeKey]: {
        width: current.currentWidth,
        height: current.currentHeight,
      },
    };

    const defaultNext = {
      width: nextDesignWidth,
      height: nextDesignHeight,
    };

    const savedSize = savedLayoutSizes[nextModeKey] ?? defaultNext;
    nextWidth = savedSize.width;
    nextHeight = savedSize.height;
  } else if (cellsChanged) {
    nextHeight = Math.round(current.currentHeight * (nextRows / prevRows));
  }

  return {
    designWidth: nextDesignWidth,
    designHeight: nextDesignHeight,
    currentWidth: nextWidth,
    currentHeight: nextHeight,
    userSettingsPatch: { layoutSizes: savedLayoutSizes },
  };
};

export const ENGINE_PANEL_MANIFEST: WidgetManifest = {
  id: 'engine-panel',
  order: 200,
  telemetryEvents: ['carInputs'],
  previewScenarios: [
    'engine-oil-overheat',
    'engine-water-overheat',
    'engine-stalled',
    'hybrid-deploying',
  ],
  label: 'Engine Panel',
  description:
    'Liquid temperatures, pressures, and every in-car adjustment the car exposes — ABS, traction control, brake bias, engine map, engine braking and the differential.',
  requiredCapabilities: ['playerDynamics'],
  autoHeight: true,
  designWidth: 500,
  designHeight: 65,
  resolveLayoutChange: resolveEnginePanelLayout,
  userSettings: {
    enabled: false,
    x: 400,
    y: 400,
    currentWidth: 500,
    currentHeight: 65,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showOilTemp: true,
    showWaterTemp: true,
    showOilPress: true,
    showVoltage: true,
    showAbs: true,
    showTc: true,
    showTc2: true,
    showBrakeBias: true,
    showBrakeBiasFine: true,
    showPeakBrakeBias: true,
    showEngineMap: true,
    showEngineBraking: true,
    showDiffEntry: true,
    showDiffMiddle: true,
    showDiffExit: true,
    highlightChanges: true,
    horizontal: true,
    verticalColumns: 2,
    horizontalColumns: 8,
  },
};

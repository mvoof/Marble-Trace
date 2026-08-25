import type { WidgetManifest } from '@/types/widget-settings';
import type {
  EnginePanelWidgetSettings,
  ResolveLayoutChange,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

const getCellCount = (s: any) => {
  return [
    s.showOilTemp !== false,
    s.showWaterTemp !== false,
    s.showOilPress !== false,
    s.showVoltage !== false,
    s.showAbs !== false,
    s.showTc !== false,
    s.showBrakeBias !== false,
    s.showEngineMap !== false,
  ].filter(Boolean).length;
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

  const cellKeys = [
    'showOilTemp',
    'showWaterTemp',
    'showOilPress',
    'showVoltage',
    'showAbs',
    'showTc',
    'showBrakeBias',
    'showEngineMap',
  ];

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

  const prevRows = Math.max(1, Math.ceil(prevCells / prevCols));
  const nextRows = Math.max(1, Math.ceil(nextCells / nextCols));

  const nextDesignWidth = nextCols * 62.5;
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
  label: 'Engine Panel',
  description:
    'Liquid temperatures, pressures, and system adjustments (ABS, TC, Brake Bias, Engine Map).',
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
    showBrakeBias: true,
    showEngineMap: true,
    horizontal: true,
    verticalColumns: 2,
    horizontalColumns: 8,
  },
};

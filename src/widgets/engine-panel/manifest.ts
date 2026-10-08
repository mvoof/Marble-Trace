import type {
  ResolveLayoutChange,
  WidgetManifest,
} from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import {
  CELL_SETTING_KEYS,
  UNIT_WIDTH,
  enabledCellSlots,
  panelHeight,
  planEnginePanel,
  rowUnits,
} from './engine-panel-utils';
import { ENGINE_PANEL_SETTINGS } from './settings-schema';

/**
 * The size the user left each layout mode at, by mode, so switching back
 * restores it. Kept beside the settings but not one of them: the schema does
 * not describe it, so it lives for the session and is not written to the file.
 */
type LayoutSizes = Record<string, { width: number; height: number }>;

/** The size the widget will actually draw at, in design px. */
const measure = (
  settings: Record<string, unknown>,
  maxCols: number
): { width: number; height: number; rows: number } => {
  const rows = planEnginePanel(enabledCellSlots(settings), maxCols);
  const widest = Math.max(1, ...rows.map(rowUnits));

  return {
    width: widest * UNIT_WIDTH,
    height: panelHeight(rows),
    rows: Math.max(1, rows.length),
  };
};

const resolveEnginePanelLayout: ResolveLayoutChange = (prev, next, current) => {
  const prevHorizontal = 'horizontal' in prev ? !!prev.horizontal : true;
  const nextHorizontal =
    'horizontal' in next ? !!next.horizontal : prevHorizontal;

  const prevVertCols =
    'verticalColumns' in prev ? Number(prev.verticalColumns) : 3;
  const nextVertCols =
    'verticalColumns' in next ? Number(next.verticalColumns) : prevVertCols;

  const prevHorizCols =
    'horizontalColumns' in prev ? Number(prev.horizontalColumns) : 12;
  const nextHorizCols =
    'horizontalColumns' in next
      ? Number(next.horizontalColumns)
      : prevHorizCols;

  const modeChanged =
    prevHorizontal !== nextHorizontal ||
    prevVertCols !== nextVertCols ||
    prevHorizCols !== nextHorizCols;

  const cellsChanged = CELL_SETTING_KEYS.some(
    (key) => (prev as any)[key] !== (next as any)[key]
  );

  if (!modeChanged && !cellsChanged) {
    return null;
  }

  const prevCols = prevHorizontal ? prevHorizCols : prevVertCols;
  const nextCols = nextHorizontal ? nextHorizCols : nextVertCols;

  const before = measure(prev as unknown as Record<string, unknown>, prevCols);
  const after = measure(next as unknown as Record<string, unknown>, nextCols);

  const prevLayoutSizes = (prev.layoutSizes ?? {}) as LayoutSizes;

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

    const savedSize = savedLayoutSizes[nextModeKey] ?? {
      width: after.width,
      height: after.height,
    };

    nextWidth = savedSize.width;
    nextHeight = savedSize.height;
  } else if (cellsChanged) {
    nextHeight = Math.round(current.currentHeight * (after.rows / before.rows));
  }

  return {
    designWidth: after.width,
    designHeight: after.height,
    currentWidth: nextWidth,
    currentHeight: nextHeight,
    userSettingsPatch: { layoutSizes: savedLayoutSizes },
  };
};

export const ENGINE_PANEL_MANIFEST: WidgetManifest = {
  id: 'engine-panel',
  telemetryEvents: ['carInputs'],
  previewScenarios: [
    'engine-formula-car',
    'engine-gtp-car',
    'engine-gt3-car',
    'engine-oil-overheat',
    'engine-water-overheat',
    'engine-stalled',
    'hybrid-deploying',
  ],
  label: 'Engine Panel',
  description:
    'Liquid temperatures, pressures, and every in-car adjustment the car exposes — ABS, traction control, brake bias, engine map, engine braking and the differential, grouped by system.',
  requiredCapabilities: ['playerDynamics'],
  autoHeight: true,
  designWidth: 687.5,
  designHeight: 124,
  resolveLayoutChange: resolveEnginePanelLayout,
  userSettings: {
    enabled: false,
    x: 400,
    y: 400,
    currentWidth: 687.5,
    currentHeight: 124,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...ENGINE_PANEL_SETTINGS.defaults,
  },
  settingsSchema: ENGINE_PANEL_SETTINGS,
};

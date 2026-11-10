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
  panelLayoutOf,
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
  settings: Record<string, unknown>
): { width: number; height: number; rows: number } => {
  const layout = panelLayoutOf(settings);
  const rows = planEnginePanel(enabledCellSlots(settings), layout);
  const widest = Math.max(1, ...rows.map(rowUnits));

  return {
    width: widest * UNIT_WIDTH,
    height: panelHeight(rows, layout.horizontal),
    rows: Math.max(1, rows.length),
  };
};

/**
 * The design width the settings imply. The cells scale by `--wfs =
 * currentWidth / designWidth` while the rows divide the frame by width units,
 * so a stored width that disagrees with this one draws the values at a size
 * their cells were never measured for — and they spill into the neighbours.
 */
const designWidthOf = (settings: Record<string, unknown>): number =>
  measure(settings).width;

/** The key the size of a layout mode is remembered under. */
const modeKeyOf = (settings: Record<string, unknown>): string => {
  const layout = panelLayoutOf(settings);

  return layout.horizontal ? `horizontal-${layout.rows}` : 'vertical';
};

const resolveEnginePanelLayout: ResolveLayoutChange = (prev, next, current) => {
  const prevSettings = prev as unknown as Record<string, unknown>;
  const nextSettings = next as unknown as Record<string, unknown>;

  const prevModeKey = modeKeyOf(prevSettings);
  const nextModeKey = modeKeyOf(nextSettings);
  const modeChanged = prevModeKey !== nextModeKey;

  const cellsChanged = CELL_SETTING_KEYS.some(
    (key) => prevSettings[key] !== nextSettings[key]
  );

  if (!modeChanged && !cellsChanged) {
    return null;
  }

  const before = measure(prevSettings);
  const after = measure(nextSettings);

  const prevLayoutSizes = (prev.layoutSizes ?? {}) as LayoutSizes;

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
    // The frame grows or shrinks with the cells rather than the cells with the
    // frame: `--wfs` stays where the user left it, so turning a cell on does
    // not shrink every value to make room for it.
    const scale = current.designWidth
      ? current.currentWidth / current.designWidth
      : 1;

    nextWidth = Math.round(after.width * scale);
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
  designHeight: 92,
  resolveLayoutChange: resolveEnginePanelLayout,
  deriveDesignWidth: designWidthOf,
  userSettings: {
    enabled: false,
    x: 400,
    y: 400,
    currentWidth: 687.5,
    currentHeight: 92,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...ENGINE_PANEL_SETTINGS.defaults,
  },
  settingsSchema: ENGINE_PANEL_SETTINGS,
};

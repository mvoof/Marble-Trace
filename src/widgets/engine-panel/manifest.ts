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
  enabledCellSlots,
  panelHeight,
  panelWidth,
  planEnginePanel,
} from './engine-panel-utils';
import { ENGINE_PANEL_SETTINGS } from './settings-schema';

/** The size the widget will actually draw at, in design px. */
const measure = (
  settings: Record<string, unknown>
): { width: number; height: number } => {
  const strips = planEnginePanel(enabledCellSlots(settings));

  return { width: panelWidth(strips), height: panelHeight(strips) };
};

/**
 * The design width the settings imply. The cells scale by `--wfs =
 * currentWidth / designWidth` while the strips share the frame by the cells'
 * widths, so a stored width that disagrees with this one draws the values at a
 * size their cells were never measured for — and they spill into the
 * neighbours.
 */
const designWidthOf = (settings: Record<string, unknown>): number =>
  measure(settings).width;

const resolveEnginePanelLayout: ResolveLayoutChange = (prev, next, current) => {
  const prevSettings = prev as unknown as Record<string, unknown>;
  const nextSettings = next as unknown as Record<string, unknown>;

  const cellsChanged = CELL_SETTING_KEYS.some(
    (key) => prevSettings[key] !== nextSettings[key]
  );

  if (!cellsChanged) {
    return null;
  }

  const after = measure(nextSettings);

  // The frame grows or shrinks with the cells rather than the cells with the
  // frame: `--wfs` stays where the user left it, so turning a cell on does not
  // shrink every value to make room for it.
  const scale = current.designWidth
    ? current.currentWidth / current.designWidth
    : 1;

  return {
    designWidth: after.width,
    designHeight: after.height,
    currentWidth: Math.round(after.width * scale),
    currentHeight: Math.round(after.height * scale),
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
  designWidth: 332,
  designHeight: 186,
  resolveLayoutChange: resolveEnginePanelLayout,
  deriveDesignWidth: designWidthOf,
  userSettings: {
    enabled: false,
    x: 400,
    y: 400,
    currentWidth: 332,
    currentHeight: 186,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...ENGINE_PANEL_SETTINGS.defaults,
  },
  settingsSchema: ENGINE_PANEL_SETTINGS,
};

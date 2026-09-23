import type {
  WheelToWheelWidgetSettings,
  WidgetManifest,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';

// Each layout has exactly one design width, so the stored one is a cache of
// what `layout` already answers — derived on every load and sync, it cannot
// drift and rescale the other layout on the next switch.
const COLUMNS_DESIGN_WIDTH = 620;
const ROWS_DESIGN_WIDTH = 560;
const WHEEL_TO_WHEEL_DESIGN_HEIGHT = 130;

const wheelToWheelDesignWidth = (settings: WheelToWheelWidgetSettings) =>
  settings.layout === 'rows' ? ROWS_DESIGN_WIDTH : COLUMNS_DESIGN_WIDTH;

const WHEEL_TO_WHEEL_DEFAULTS: WheelToWheelWidgetSettings = {
  layout: 'columns',
  gapThreshold: 1,
  hideDelay: 3,
  // Off: a car passing you in practice is a fight worth seeing too, and the
  // gap threshold already keeps random traffic off the plate.
  raceOnly: false,
  includeLapped: false,
};

export const WHEEL_TO_WHEEL_MANIFEST: WidgetManifest = {
  id: 'wheel-to-wheel',
  order: 270,
  previewScenarios: ['field-close-pack'],
  telemetryEvents: ['relative'],
  requiredCapabilities: ['relative'],
  label: 'Wheel to Wheel',
  description: 'You and your nearest rival side by side: gap and speed.',
  // The rows layout grows a row per rival, so the height is the content's.
  autoHeight: true,
  designWidth: COLUMNS_DESIGN_WIDTH,
  designHeight: WHEEL_TO_WHEEL_DESIGN_HEIGHT,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: COLUMNS_DESIGN_WIDTH,
    currentHeight: WHEEL_TO_WHEEL_DESIGN_HEIGHT,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...WHEEL_TO_WHEEL_DEFAULTS,
  },
  resolveLayoutChange:
    makeExactColumnLayoutResolver<WheelToWheelWidgetSettings>(
      ['layout'],
      wheelToWheelDesignWidth
    ),
  deriveDesignWidth: (settings) =>
    wheelToWheelDesignWidth(settings as unknown as WheelToWheelWidgetSettings),
};

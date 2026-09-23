import type {
  WheelToWheelWidgetSettings,
  WidgetManifest,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

const WHEEL_TO_WHEEL_DESIGN_WIDTH = 620;
const WHEEL_TO_WHEEL_DESIGN_HEIGHT = 130;

const WHEEL_TO_WHEEL_DEFAULTS: WheelToWheelWidgetSettings = {
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
  designWidth: WHEEL_TO_WHEEL_DESIGN_WIDTH,
  designHeight: WHEEL_TO_WHEEL_DESIGN_HEIGHT,
  lockAspectRatio: true,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: WHEEL_TO_WHEEL_DESIGN_WIDTH,
    currentHeight: WHEEL_TO_WHEEL_DESIGN_HEIGHT,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...WHEEL_TO_WHEEL_DEFAULTS,
  },
};

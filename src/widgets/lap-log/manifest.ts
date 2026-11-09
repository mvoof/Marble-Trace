import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@widgets/widget-manifest';
import { computeLapLogDesignWidth } from './lap-log-utils';
import { LAP_LOG_SETTINGS, type LapLogWidgetSettings } from './settings-schema';

const LAP_LOG_DESIGN_WIDTH = computeLapLogDesignWidth(
  LAP_LOG_SETTINGS.defaults
);

export const LAP_LOG_MANIFEST: WidgetManifest = {
  id: 'lap-log',
  label: 'Lap Log',
  description:
    'Recent laps: time and delta to your best. A taller widget shows more laps.',
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['delta-personal-best'],
  // Hiding the delta column narrows the frame by its share, keeping the scale.
  resolveLayoutChange: makeExactColumnLayoutResolver<LapLogWidgetSettings>(
    ['showDelta'],
    computeLapLogDesignWidth
  ),
  deriveDesignWidth: (settings) =>
    computeLapLogDesignWidth(settings as unknown as LapLogWidgetSettings),
  designWidth: LAP_LOG_DESIGN_WIDTH,
  transparentContainer: true,
  designHeight: 385,
  userSettings: {
    enabled: false,
    x: 700,
    y: 300,
    currentWidth: LAP_LOG_DESIGN_WIDTH,
    currentHeight: 385,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...LAP_LOG_SETTINGS.defaults,
  },
  settingsSchema: LAP_LOG_SETTINGS,
};

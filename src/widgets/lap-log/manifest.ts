import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { LAP_LOG_SETTINGS } from './settings-schema';

export const LAP_LOG_MANIFEST: WidgetManifest = {
  id: 'lap-log',
  label: 'Lap Log',
  description:
    'Recent laps: time and delta to your best. A taller widget shows more laps.',
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['delta-personal-best'],
  designWidth: 264,
  designHeight: 389,
  userSettings: {
    enabled: false,
    x: 700,
    y: 300,
    currentWidth: 264,
    currentHeight: 389,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...LAP_LOG_SETTINGS.defaults,
  },
  settingsSchema: LAP_LOG_SETTINGS,
};

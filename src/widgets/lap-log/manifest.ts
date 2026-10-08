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
    'Last 8 laps with time and delta vs personal best. Best lap highlighted.',
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['delta-personal-best'],
  autoHeight: true,
  designWidth: 220,
  designHeight: 260,
  userSettings: {
    enabled: false,
    x: 700,
    y: 300,
    currentWidth: 220,
    currentHeight: 260,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
  },
  settingsSchema: LAP_LOG_SETTINGS,
};

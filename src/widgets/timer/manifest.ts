import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { TIMER_SETTINGS } from './settings-schema';

export const TIMER_MANIFEST: WidgetManifest = {
  id: 'timer',
  telemetryEvents: ['driverEntries'],
  previewScenarios: ['timer-final-minute', 'timer-lap-limited'],
  label: 'Timer',
  description: 'Stint and total session timers.',
  autoHeight: true,
  requiredCapabilities: ['playerDynamics'],
  designWidth: 240,
  designHeight: 120,
  userSettings: {
    enabled: false,
    x: 50,
    y: 310,
    currentWidth: 240,
    currentHeight: 120,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...TIMER_SETTINGS.defaults,
  },
  settingsSchema: TIMER_SETTINGS,
};

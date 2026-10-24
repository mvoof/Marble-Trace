import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { ABS_SETTINGS } from './settings-schema';

export const ABS_MANIFEST: WidgetManifest = {
  id: 'abs',
  // The level rides the always-sent carStatus frame; the light is carInputs.
  telemetryEvents: ['carInputs'],
  requiredCapabilities: ['playerDynamics'],
  label: 'ABS',
  description:
    'The ABS setting from the cockpit, with a badge that lights while ABS is working.',
  // The badge takes the larger share; the level is two digits at most.
  designWidth: 150,
  designHeight: 52,
  userSettings: {
    enabled: false,
    x: 700,
    y: 660,
    currentWidth: 150,
    currentHeight: 52,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...ABS_SETTINGS.defaults,
  },
  settingsSchema: ABS_SETTINGS,
};

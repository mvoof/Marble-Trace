import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { RPM_LIGHTS_SETTINGS } from './settings-schema';

export const RPM_LIGHTS_MANIFEST: WidgetManifest = {
  id: 'rpm-lights',
  telemetryEvents: ['carDynamics'],
  label: 'RPM Lights',
  description:
    'Standalone shift-light LED bar driven by engine RPM, with pit-limiter animations.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 360,
  designHeight: 36,
  userSettings: {
    enabled: false,
    x: 400,
    y: 60,
    currentWidth: 360,
    currentHeight: 36,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...RPM_LIGHTS_SETTINGS.defaults,
  },
  settingsSchema: RPM_LIGHTS_SETTINGS,
};

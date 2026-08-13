import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const RPM_LIGHTS_MANIFEST: WidgetManifest = {
  id: 'rpm-lights',
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
    rpmColorTheme: 'custom',
    rpmColorLow: '#10b981',
    rpmColorMid: '#eab308',
    rpmColorHigh: '#ef4444',
    rpmColorShift: '#a855f7',
    rpmColorLimit: '#f97316',
    ledShape: 'square',
  },
};

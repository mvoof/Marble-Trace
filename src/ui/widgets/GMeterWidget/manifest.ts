import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const G_METER_MANIFEST: WidgetManifest = {
  id: 'g-meter',
  label: 'G-Meter',
  description: 'Lateral and longitudinal G-force friction circle.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 240,
  designHeight: 280,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: 240,
    currentHeight: 280,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
  },
};

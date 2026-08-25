import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const LAP_LOG_MANIFEST: WidgetManifest = {
  id: 'lap-log',
  order: 190,
  label: 'Lap Log',
  description:
    'Last 8 laps with time and delta vs personal best. Best lap highlighted.',
  requiredCapabilities: ['playerDynamics'],
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
};

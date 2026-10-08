import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';

export const RADAR_BAR_MANIFEST: WidgetManifest = {
  id: 'radar-bar',
  previewScenarios: [
    'radar-traffic',
    'traffic-left',
    'traffic-right',
    'traffic-three-wide',
    'traffic-rear-bumper',
  ],
  telemetryEvents: ['proximity'],
  label: 'Radar Bar',
  description: 'Full-width side proximity indicators.',
  requiredCapabilities: ['radar'],
  designWidth: 800,
  designHeight: 380,
  userSettings: {
    enabled: false,
    x: 200,
    y: 300,
    currentWidth: 800,
    currentHeight: 380,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    qualifyingVisibility: 'auto',
    showDistance: true,
  },
};

import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const PROXIMITY_RADAR_MANIFEST: WidgetManifest = {
  id: 'proximity-radar',
  telemetryEvents: ['proximity'],
  label: 'Proximity Radar',
  description: 'Visual radar for nearby traffic.',
  requiredCapabilities: ['radar'],
  designWidth: 200,
  designHeight: 300,
  userSettings: {
    enabled: true,
    x: 600,
    y: 300,
    currentWidth: 200,
    currentHeight: 300,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    proximityThreshold: 5,
    hideDelay: 2,
    carLength: 4.4,
    qualifyingVisibility: 'auto',
    showDistance: true,
  },
};

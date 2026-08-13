import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const RADAR_BAR_MANIFEST: WidgetManifest = {
  id: 'radar-bar',
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
    proximityThreshold: 3,
    hideDelay: 2,
    carLength: 4.4,
    qualifyingVisibility: 'auto',
    showDistance: true,
  },
};

import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const DELTA_MANIFEST: WidgetManifest = {
  id: 'delta',
  order: 120,
  label: 'Delta HUD',
  description: 'Live delta HUD — one glance, am I faster or slower?',
  requiredCapabilities: ['sectors'],
  designWidth: 200,
  designHeight: 100,
  // The delta bar deliberately runs wider than the widget box so the scale
  // reads at a glance — it must not be clipped to the panel.
  overflowVisible: true,
  userSettings: {
    enabled: false,
    x: 400,
    y: 200,
    currentWidth: 200,
    currentHeight: 100,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    reference: 'personal_best',
    showLapFlash: false,
    flashDuration: 5,
    hideWhenNoReference: false,
    showGauge: true,
  },
};

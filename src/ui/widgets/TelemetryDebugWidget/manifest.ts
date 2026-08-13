import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const EXAMPLE_MANIFEST: WidgetManifest = {
  id: 'example',
  label: 'Telemetry Debug',
  description: 'Raw telemetry data debugger.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 400,
  designHeight: 700,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: 400,
    currentHeight: 700,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
  },
};

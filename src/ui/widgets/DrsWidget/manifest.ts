import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const DRS_MANIFEST: WidgetManifest = {
  id: 'drs',
  order: 260,
  // DRS rides the always-sent 4 Hz carStatus frame, so there is no gated field
  // to declare.
  telemetryEvents: [],
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['drs-ready', 'drs-open'],
  label: 'DRS',
  description:
    'Drag reduction system state: armed past the detection point, ready inside the zone, open.',
  designWidth: 136,
  designHeight: 46,
  userSettings: {
    enabled: false,
    x: 700,
    y: 600,
    currentWidth: 136,
    currentHeight: 46,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    hideWhenUnavailable: false,
  },
};

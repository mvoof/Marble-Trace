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
  previewScenarios: ['drs-armed', 'drs-ready', 'drs-open'],
  label: 'DRS',
  description:
    'Drag reduction system state: armed past the detection point, ready inside the zone, open.',
  // Sized to the row it holds: mark, rule, name and the longest state word
  // ("ACTIVE") at their design sizes, plus the padding around them.
  designWidth: 215,
  designHeight: 56,
  userSettings: {
    enabled: false,
    x: 700,
    y: 600,
    currentWidth: 215,
    currentHeight: 56,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    hideWhenUnavailable: false,
    hideWhenCarHasNoDrs: true,
  },
};

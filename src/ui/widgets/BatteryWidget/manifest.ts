import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const BATTERY_MANIFEST: WidgetManifest = {
  id: 'battery',
  order: 250,
  // Everything it reads rides the always-sent 4 Hz carStatus frame, so there is
  // no gated field to declare. An entry here would cost every window traffic
  // this widget never looks at.
  telemetryEvents: [],
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['hybrid-deploying', 'hybrid-harvesting'],
  // The baseline car is a GT3: no battery, so the widget correctly draws
  // nothing against it and the picker would be offering an empty pane.
  previewBaseline: false,
  label: 'Battery',
  description:
    'Hybrid battery charge, what the MGU-K is doing with it, and the deploy mode on cars that expose a selector.',
  autoHeight: true,
  designWidth: 280,
  designHeight: 92,
  userSettings: {
    enabled: false,
    x: 300,
    y: 500,
    currentWidth: 280,
    currentHeight: 92,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showDeployMode: true,
    showPower: true,
    // Off by default: it is a debrief number, not something read at the apex.
    showLapDeploy: false,
    compactMode: false,
  },
};

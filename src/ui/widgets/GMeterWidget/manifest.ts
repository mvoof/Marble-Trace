import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

/** The plate is the circle, so one number sizes the whole widget. */
const G_METER_DESIGN_SIZE_PX = 240;

export const G_METER_MANIFEST: WidgetManifest = {
  id: 'g-meter',
  order: 170,
  telemetryEvents: ['carDynamics'],
  label: 'G-Meter',
  description: 'Lateral and longitudinal G-force friction circle.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: G_METER_DESIGN_SIZE_PX,
  designHeight: G_METER_DESIGN_SIZE_PX,
  // The friction circle has one dimension: a stretched box would clip the
  // plate to an ellipse and leave the circle drawn off-centre inside it.
  lockAspectRatio: true,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: G_METER_DESIGN_SIZE_PX,
    currentHeight: G_METER_DESIGN_SIZE_PX,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    borderColor: 'transparent',
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
  },
};

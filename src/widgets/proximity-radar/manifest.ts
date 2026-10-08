import type { WidgetManifest } from '@shared/contracts/widget-settings';
import { COMMON_WIDGET_DEFAULTS } from '@widgets/widget-manifest';
import { PROXIMITY_RADAR_SETTINGS } from '@entities/radar/radar.settings-schema';

/**
 * The scope is a disc, so its plate is the circle itself — `widgetFrameStyle`
 * clips it round and paints it from these two colors. They ship visible rather
 * than transparent: an instrument reads as an instrument only once it has a
 * rim, and a user who wants the old bare-icons look sets both to transparent.
 */
const SCOPE_APPEARANCE_DEFAULTS = {
  backgroundColor: 'rgba(12, 14, 18, 0.55)',
  borderColor: 'rgba(255, 255, 255, 0.18)',
};

/** 180 px of widget covers a 10 m radius — see `utils/radar-constants.ts`. */
const SCOPE_DESIGN_SIZE_PX = 180;

export const PROXIMITY_RADAR_MANIFEST: WidgetManifest = {
  id: 'proximity-radar',
  previewScenarios: [
    'radar-traffic',
    'traffic-left',
    'traffic-right',
    'traffic-three-wide',
    'traffic-rear-bumper',
  ],
  telemetryEvents: ['proximity'],
  label: 'Proximity Radar',
  description: 'Visual radar for nearby traffic.',
  requiredCapabilities: ['radar'],
  designWidth: SCOPE_DESIGN_SIZE_PX,
  designHeight: SCOPE_DESIGN_SIZE_PX,
  // A disc has one dimension: a stretched box would clip the plate to an
  // ellipse and leave the scope drawn off-centre inside it.
  lockAspectRatio: true,
  userSettings: {
    enabled: true,
    x: 600,
    y: 300,
    currentWidth: SCOPE_DESIGN_SIZE_PX,
    currentHeight: SCOPE_DESIGN_SIZE_PX,
    ...COMMON_WIDGET_DEFAULTS,
    ...SCOPE_APPEARANCE_DEFAULTS,
    ...PROXIMITY_RADAR_SETTINGS.defaults,
  },
  settingsSchema: PROXIMITY_RADAR_SETTINGS,
};

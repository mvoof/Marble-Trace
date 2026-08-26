import type { WidgetManifest } from '@/types/widget-settings';
import { COMMON_WIDGET_DEFAULTS } from '@ui/widgets/widget-manifest';

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

/** 180 px of widget covers a 10 m radius — see `radar-scope-utils.ts`. */
const SCOPE_DESIGN_SIZE_PX = 180;

export const PROXIMITY_RADAR_MANIFEST: WidgetManifest = {
  id: 'proximity-radar',
  order: 20,
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
    proximityThreshold: 5,
    hideDelay: 2,
    qualifyingVisibility: 'auto',
    showDistance: true,
    scaleMode: 'fixed-scope',
    scopeRange: 10,
    backgroundTexture: 'polar-dots',
    showAxes: true,
    showAxisTicks: true,
    showRangeRings: true,
    showBeam: true,
  },
};

import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/** 'projection' = bloom in the tint color, 'contour' = hairline stroke, no glow. */
export const INVISIBLE_DASH_RENDER_MODE = ['projection', 'contour'] as const;
export type InvisibleDashRenderMode =
  (typeof INVISIBLE_DASH_RENDER_MODE)[number];

export const INVISIBLE_DASH_RPM_FORMAT = ['absolute', 'percent'] as const;
export type InvisibleDashRpmFormat = (typeof INVISIBLE_DASH_RPM_FORMAT)[number];

export const INVISIBLE_DASH_BACKDROP_SCOPE = ['clusters', 'full'] as const;
export type InvisibleDashBackdropScope =
  (typeof INVISIBLE_DASH_BACKDROP_SCOPE)[number];

const PERCENT = { min: 0, max: 100 };

export const INVISIBLE_DASH_SETTINGS = defineSettings('invisibleDash', {
  showSpeed: bool(true),
  showRpm: bool(true),
  showGear: bool(true),
  showPosition: bool(true),
  showLap: bool(true),
  showShiftBar: bool(true),
  renderMode: choice(INVISIBLE_DASH_RENDER_MODE, 'projection'),
  /** Strength of the projection bloom, 0–100. Ignored in contour mode. */
  bloomIntensity: num(60, PERCENT),
  /** Color the projection glows in — the halo only, not the glyphs. */
  projectionTint: color('#bfe3ff'),
  /** Color of the digits themselves, below the high rev zone. */
  textColor: color('#ffffff'),
  /**
   * Wash behind the digits — the clusters only, never the empty middle. Carries
   * its own alpha, so a fully transparent value leaves the digits on bare glass.
   */
  backdropColor: color('rgba(0, 0, 0, 0)'),
  /**
   * Where the wash is painted: behind each cluster, or behind the whole strip.
   * 'full' keeps the plate in the strip's own tilted plane, so it foreshortens
   * with the digits instead of reading as a flat panel on the glass.
   */
  backdropScope: choice(INVISIBLE_DASH_BACKDROP_SCOPE, 'clusters'),
  rpmColorLow: color('#10b981', { label: 'common.rpmColorLow' }),
  rpmColorMid: color('#eab308', { label: 'common.rpmColorMid' }),
  rpmColorHigh: color('#ef4444', { label: 'common.rpmColorHigh' }),
  rpmColorShift: color('#a855f7', { label: 'common.rpmColorShift' }),
  rpmColorLimit: color('#f97316', { label: 'common.rpmColorLimit' }),
  /** Tint the RPM number with the zone color at high revs. */
  colorizeRpmByZone: bool(true),
  /** Tint the gear digit with the zone color at high revs. */
  colorizeGearByZone: bool(false),
  /** How far the strip is pushed into the scene, 0–100: tilt, shrink and fade. */
  depth: num(45, PERCENT),
  /**
   * How hard the readout wraps around the windscreen, 0–100: the two clusters
   * yaw away from the driver and ride up toward the pillars.
   */
  curvature: num(30, PERCENT),
  rpmFormat: choice(INVISIBLE_DASH_RPM_FORMAT, 'absolute'),
  useLivePositions: bool(true),
  classPositionInMulticlass: bool(true),
});

export type InvisibleDashWidgetSettings = SettingsOf<
  typeof INVISIBLE_DASH_SETTINGS.shape
>;

import {
  bool,
  choice,
  color,
  defineSettings,
  nullable,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/**
 * 'fill' = colored RPM arc around the ring, 'comb' = discrete ticks on that
 * same ring, 'glow' = rim glows near shift, 'off' = no RPM indication.
 */
export const RPM_INDICATOR_MODE = ['fill', 'comb', 'glow', 'off'] as const;
export type RpmIndicatorMode = (typeof RPM_INDICATOR_MODE)[number];

export const RACE_DASH_SETTINGS = defineSettings('raceDash', {
  /** In the driver's speed unit; `null` reads the limit from the session. */
  pitSpeedLimitOverride: nullable(num(0, { min: 0, max: 200, step: 5 }), null),
  showPitAssist: bool(true),
  /** Meters before the pit box at which the box cue fires. */
  boxCueDistM: num(50, { min: 0, max: 1000 }),
  /** Below the pit limit by this much, in the driver's speed unit, the speed turns amber. */
  nearLimitDelta: num(5, { min: 1, max: 30, step: 1 }),
  rpmColorLow: color('#10b981', { label: 'common.rpmColorLow' }),
  rpmColorMid: color('#eab308', { label: 'common.rpmColorMid' }),
  rpmColorHigh: color('#ef4444', { label: 'common.rpmColorHigh' }),
  rpmColorShift: color('#a855f7', { label: 'common.rpmColorShift' }),
  rpmColorLimit: color('#f97316', { label: 'common.rpmColorLimit' }),
  /** Tint the gear digit and RPM number with the zone color at high revs. */
  colorizeByRpmZone: bool(true),
  rpmIndicatorMode: choice(RPM_INDICATOR_MODE, 'fill'),
  /** Source of the P-number in the stats strip and the pit block. */
  useLivePositions: bool(true, { label: 'common.useLivePositions' }),
  /** Count the P-number within the player's own class instead of the whole field, in multiclass sessions. */
  classPositionInMulticlass: bool(true, {
    label: 'common.classPositionInMulticlass',
  }),
  /** Tint the P-number by which band of the field the player is running in. */
  colorizePosition: bool(true),
  positionColorP1: color('#fbbf24'),
  positionColorTop3: color('#10b981'),
  positionColorTop5: color('#38bdf8'),
  positionColorTop10: color('#cbd5e1'),
  positionColorRest: color('#7c8794'),
  /** Steering angle wedge riding the outer rim of the gear ring. */
  showSteeringMarker: bool(false),
  /** Color of the trail the steering marker leaves behind it on the rim. */
  steeringTrailColor: color('#f59e0b'),
});

export type RaceDashWidgetSettings = SettingsOf<
  typeof RACE_DASH_SETTINGS.shape
>;

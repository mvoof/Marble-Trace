import type {
  BattleOtherClass,
  BattleSides,
  BattleTrigger,
  CoachTraceChannel,
  FlagZoneStyle,
  FuelWidgetSettings,
  GMeterColorMode,
  GMeterDisplayMode,
  InvisibleDashBackdropScope,
  InvisibleDashRenderMode,
  InvisibleDashRpmFormat,
  LedShape,
  LinearMapOrientation,
  RadarBackgroundTexture,
  RadarQualifyingVisibility,
  RadarScaleMode,
  RowPadding,
  RpmIndicatorMode,
  RpmLightsWidgetSettings,
  StandingsViewMode,
  SteeringCenterDisplay,
  SteeringWheelStyle,
  TrackMapLeaderLabelMode,
  TrackMapWidgetSettings,
  WheelToWheelLayout,
} from '@shared/contracts/widget-settings';

/**
 * Lists every member of a string union, and fails to compile when one is
 * missing — a union leaves no trace at runtime, so this is the only way a
 * select control can offer it without drifting from the type.
 */
const allOf =
  <Union extends string>() =>
  <Values extends readonly Union[]>(
    ...values: Values &
      ([Union] extends [Values[number]] ? unknown : ['missing a member'])
  ): readonly Union[] =>
    values;

/**
 * Members of each string-union setting, by setting key, for the select control
 * the story Controls draw. A key shared by several widgets holds the same type
 * in each of them.
 */
export const SETTING_OPTIONS: Record<string, readonly string[]> = {
  trigger: allOf<BattleTrigger>()('gap', 'distance'),
  sides: allOf<BattleSides>()('both', 'ahead', 'behind'),
  otherClass: allOf<BattleOtherClass>()('show', 'dim', 'hide'),
  qualifyingVisibility: allOf<RadarQualifyingVisibility>()(
    'always',
    'never',
    'auto'
  ),
  traceChannel: allOf<CoachTraceChannel>()('speed', 'brake'),
  chartType: allOf<FuelWidgetSettings['chartType']>()('line', 'bar'),
  displayMode: allOf<GMeterDisplayMode>()('trail', 'fading', 'peak'),
  colorMode: allOf<GMeterColorMode>()('mono', 'simple', 'advanced'),
  steeringCenterDisplay: allOf<SteeringCenterDisplay>()(
    'none',
    'logo',
    'gear',
    'speed',
    'angle',
    'speed-gear'
  ),
  steeringWheelStyle: allOf<SteeringWheelStyle>()(
    'default',
    'gt-round',
    'flat-bottom',
    'bagel',
    'formula-open',
    'formula-compact',
    'formula-conspit',
    'formula-conspit-pro',
    'formula-gt-hybrid'
  ),
  renderMode: allOf<InvisibleDashRenderMode>()('projection', 'contour'),
  backdropScope: allOf<InvisibleDashBackdropScope>()('clusters', 'full'),
  rpmFormat: allOf<InvisibleDashRpmFormat>()('absolute', 'percent'),
  scaleMode: allOf<RadarScaleMode>()('fixed-scope', 'fixed-cars', 'manual'),
  backgroundTexture: allOf<RadarBackgroundTexture>()(
    'none',
    'polar-dots',
    'polar-mesh',
    'hatch',
    'scanlines'
  ),
  rpmIndicatorMode: allOf<RpmIndicatorMode>()('fill', 'comb', 'glow', 'off'),
  orientation: allOf<LinearMapOrientation>()('horizontal', 'vertical'),
  flagZoneStyle: allOf<FlagZoneStyle>()('filled', 'outline'),
  rowPadding: allOf<RowPadding>()('narrow', 'medium', 'wide'),
  rpmColorTheme: allOf<RpmLightsWidgetSettings['rpmColorTheme']>()(
    'custom',
    'gradient',
    'classic'
  ),
  ledShape: allOf<LedShape>()('square', 'circle', 'parallelogram'),
  viewMode: allOf<StandingsViewMode>()('all', 'cycling', 'grouped'),
  rotationMode: allOf<TrackMapWidgetSettings['rotationMode']>()(
    'fixed',
    'heading-up'
  ),
  leaderLabelMode: allOf<TrackMapLeaderLabelMode>()('all', 'own-class', 'none'),
  layout: allOf<WheelToWheelLayout>()('columns', 'rows'),
};

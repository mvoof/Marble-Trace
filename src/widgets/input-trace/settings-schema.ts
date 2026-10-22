import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  nullable,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const STEERING_CENTER_DISPLAY = [
  'none',
  'logo',
  'gear',
  'speed',
  'angle',
  'speed-gear',
] as const;
export type SteeringCenterDisplay = (typeof STEERING_CENTER_DISPLAY)[number];

/**
 * `default` is the drawn dial with the running rim marker; every other value
 * names a traced wheel silhouette in `SteeringWheel/WheelArt.tsx`. The order
 * is the order the picker lists them in — a plain list, so the settings window
 * offers every wheel without bundling the silhouettes it never draws.
 */
export const STEERING_WHEEL_STYLE = [
  'default',
  'gt-round',
  'flat-bottom',
  'bagel',
  'formula-open',
  'formula-compact',
  'formula-conspit',
  'formula-conspit-pro',
  'formula-gt-hybrid',
] as const;
export type SteeringWheelStyle = (typeof STEERING_WHEEL_STYLE)[number];

export const INPUT_TRACE_SETTINGS = defineSettings('inputTrace', {
  showTrace: bool(true),
  showSteering: bool(true),
  showThrottle: bool(true),
  showBrake: bool(true),
  showClutch: bool(true),
  /** The pedal bars beside the graph; the channels still pick which ones. */
  showBars: bool(true),
  showInputValues: bool(false),
  steeringCenterDisplay: choice(STEERING_CENTER_DISPLAY, 'logo'),
  steeringWheelStyle: choice(STEERING_WHEEL_STYLE, 'default'),
  /**
   * Round backdrop under the readout. Only the wheel silhouettes offer it —
   * the drawn dial has a centre pad of its own.
   */
  steeringCenterPlate: bool(false),
  /**
   * Centre-grip stripe baked into the round wheel art (gt-round,
   * flat-bottom) — read as a CSS variable, since the SVGs draw it with
   * `fill="var(--steering-marker-color)"` rather than a fixed color.
   */
  steeringMarkerColor: color('#eab308'),
  throttleColor: color('#10b981'),
  brakeColor: color('#ef4444'),
  clutchColor: color('#3b82f6'),
  /** Paints the brake trace and bar in `absColor` while ABS is working. */
  showAbs: bool(true),
  absColor: color('#eab308'),
  /**
   * The steering angle as a line across the graph, apart from the wheel.
   * `null` until the user sets it: the line then follows `showSteering`, which
   * used to switch both — so a wheel turned off before the split keeps its
   * graph without the line. Read it through `isSteeringTraceShown`.
   */
  showSteeringTrace: nullable(bool(true), null),
  steeringTraceColor: color('rgba(255, 255, 255, 0.7)'),
  /** Paints the steering line in `slideColor` while the car slides sideways. */
  showSlide: bool(true),
  slideColor: color('#a855f7'),
  historySeconds: num(5, { min: 1, max: 60, step: 1 }),
  lineWidth: num(3.5, { min: 1, max: 10, step: 0.5 }),
  smoothing: num(0, { min: 0, max: 20, step: 1 }),
  // The physical lock-to-lock range is app-wide (appSettings.steeringLock) —
  // it describes the wheel on the desk, not this widget. Only the display
  // zoom on top of it belongs here.
  steeringZoom: num(1, { min: 1, max: 4, step: 0.5 }),
  /** The car's speed and gear, as a block of their own beside the wheel. */
  showSpeedGear: bool(false),
  /**
   * Colours the speed against the lit corner target: on it within 5 km/h,
   * over it past that. Below it, or with no reference, the speed keeps its
   * own colour.
   */
  showSpeedTargetColor: bool(false),
  speedOnTargetColor: color('#eab308'),
  speedOverTargetColor: color('#ef4444'),
  /** The entry, apex and exit speeds of the corner against the reference lap. */
  showCornerSpeeds: bool(false),
  entrySpeedColor: color('#3b82f6'),
  apexSpeedColor: color('#ef4444'),
  exitSpeedColor: color('#10b981'),
});

export type InputTraceSettings = SettingsOf<typeof INPUT_TRACE_SETTINGS.shape>;

export const isSteeringTraceShown = (
  settings: Pick<InputTraceSettings, 'showSteeringTrace' | 'showSteering'>
): boolean => settings.showSteeringTrace ?? settings.showSteering;

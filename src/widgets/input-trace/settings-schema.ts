import {
  bool,
  choice,
  color,
  defineSettings,
  num,
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
  absColor: color('#eab308'),
  historySeconds: num(5, { min: 1, max: 60, step: 1 }),
  lineWidth: num(3.5, { min: 1, max: 10, step: 0.5 }),
  smoothing: num(0, { min: 0, max: 20, step: 1 }),
  // The physical lock-to-lock range is app-wide (appSettings.steeringLock) —
  // it describes the wheel on the desk, not this widget. Only the display
  // zoom on top of it belongs here.
  steeringZoom: num(1, { min: 1, max: 4, step: 0.5 }),
});

export type InputTraceSettings = SettingsOf<typeof INPUT_TRACE_SETTINGS.shape>;

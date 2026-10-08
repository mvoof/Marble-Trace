import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/** Which channel the trace draws: the speed carried, or the brake pedal itself. */
export const COACH_TRACE_CHANNEL = ['speed', 'brake'] as const;
export type CoachTraceChannel = (typeof COACH_TRACE_CHANNEL)[number];

export const COACH_SETTINGS = defineSettings('coach', {
  /** The advisory call row on top. Off leaves the trace and the readouts alone. */
  showCallRow: bool(true),
  /** Draw the speed trace under the call row. Off leaves just the call row, and the plate shrinks to it. */
  showTrace: bool(true),
  traceChannel: choice(COACH_TRACE_CHANNEL, 'speed'),
  /** Half-width of the trace window in metres: it spans this far behind and ahead of the car. */
  windowMeters: num(150, { min: 50, max: 500, step: 25 }),
  /** Brake urgency bar under the call row. */
  showUrgencyBar: bool(true),
  /** Judge corner exits on the throttle: how late it was opened and how much pedal is missing. */
  showCornerExitCalls: bool(true),
  /** Current speed against the best lap's speed at this point, under the trace. */
  showSpeed: bool(true),
  /** Lap time of the stored reference lap the trace is compared against. */
  showReferenceLapTime: bool(true),
  /** Which reference is in use right now — the dry one or the wet one. */
  showTrackCondition: bool(true),
  brakeColor: color('#ef4444'),
  gasColor: color('#10b981'),
  /** Stored best lap the trace is compared against. */
  referenceColor: color('#a855f7'),
  /** This lap where it is up on the reference. */
  gainColor: color('#10b981'),
  /** This lap where it is down on the reference. */
  lossColor: color('#ef4444'),
});

export type CoachWidgetSettings = SettingsOf<typeof COACH_SETTINGS.shape>;

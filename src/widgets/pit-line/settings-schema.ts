import {
  bool,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const PIT_LINE_SETTINGS = defineSettings('pitLine', {
  showPitSpeed: bool(true),
  /**
   * The approach rail: a bar that fills to the stall on the way in and to the
   * pit exit once the box is behind us, with the braking cue on it. Read
   * together with the speed plate it answers the whole of "how fast, how far"
   * from one place.
   */
  showPitApproach: bool(true),
  /** Mark where braking has to start to stop in the stall. */
  showPitBrakeCue: bool(true),
  /** Write `km/h` and `m` under the columns. Off, the numbers stand alone. */
  showUnits: bool(true),
  /**
   * Meters before the pit entry line at which the bars show themselves. Their
   * own, not the pit box's: the lane bars are read on the way in and the order
   * is read a lap earlier, so one distance for both was always a compromise.
   * Zero switches it off and the bars appear on pit road; past a kilometer
   * they are up for most of a lap on a short track.
   */
  revealOnApproachM: num(300, { min: 0, max: 1000 }),
  /** Keep the bars on screen instead of only around a pit stop. */
  alwaysVisible: bool(false),
});

export type PitLineWidgetSettings = SettingsOf<typeof PIT_LINE_SETTINGS.shape>;

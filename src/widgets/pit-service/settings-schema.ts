import {
  bool,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

// The auto-mode rules and the fuel key step are not here: they are the car's,
// not this screen's, and live in the app settings (`pitAuto*`).
export const PIT_SERVICE_SETTINGS = defineSettings('pitService', {
  /**
   * Meters before the pit entry line at which the widget shows itself, so the
   * order can still be changed on the way in. Below 100 m the box arrives
   * after the braking, and past 1 km it is up for most of a lap on a short
   * track. Zero switches it off and the box appears on pit road as before.
   */
  revealOnApproachM: num(400, { min: 0, max: 1000 }),
  /** Source of the P-number in the footer. */
  useLivePositions: bool(true, { label: 'common.useLivePositions' }),
  /** Count the P-number within the player own class in multiclass sessions. */
  classPositionInMulticlass: bool(true, {
    label: 'common.classPositionInMulticlass',
  }),
  /** Estimate the position the car rejoins in, based on the repair and tow waits. */
  showProjectedPosition: bool(true),
  showFuel: bool(true),
  showTires: bool(true),
  showRepairs: bool(true),
  showFooter: bool(false),
  alwaysVisible: bool(false),
  /**
   * Seconds the widget shows itself after a command — a tire picked, the fuel
   * stepped, auto mode handed over — so a key pressed on track can be read back
   * without the panel staying up for the rest of the lap. Zero switches it off;
   * past fifteen seconds a pit entry has usually shown the panel anyway.
   *
   * The temporary-show key is not one of these: it is a latch the driver closes
   * themselves, and putting it on a timer would take the box away mid-edit.
   */
  commandRevealSeconds: num(5, { min: 0, max: 15, step: 1 }),
});

export type PitServiceWidgetSettings = SettingsOf<
  typeof PIT_SERVICE_SETTINGS.shape
>;

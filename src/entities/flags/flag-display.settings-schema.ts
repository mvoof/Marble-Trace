import {
  bool,
  defineSettings,
  num,
  numRecord,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/**
 * The settings of both flag widgets, described here beside the store they
 * share rather than in either widget's slice: the store reads the hold time,
 * and one flag widget deleted must not take the other's description with it.
 */
const FLAG_DISPLAY_SHAPE = {
  /** Show the widget even while no flag is out. */
  alwaysShow: bool(true),
  /** Seconds a flag stays on screen after it clears. */
  holdDuration: num(3, { min: 0, max: 30, step: 1 }),
};

export const FLAT_FLAGS_SETTINGS = defineSettings(
  'flagDisplay',
  FLAG_DISPLAY_SHAPE
);

export const LED_FLAGS_SETTINGS = defineSettings('flagDisplay', {
  ...FLAG_DISPLAY_SHAPE,
  /** Matrix split into a left and a right half, to sit around the mirror. */
  split: bool(false),
  animate: bool(true),
  /** One large indicator instead of the LED matrix. */
  forceSingleLed: bool(false),
  /**
   * The width the user left each mode (`single`, `split`) at, so switching back
   * restores it.
   */
  modeWidths: numRecord(),
});

export type FlagDisplaySettings = SettingsOf<typeof FLAT_FLAGS_SETTINGS.shape>;
export type LedFlagsSettings = SettingsOf<typeof LED_FLAGS_SETTINGS.shape>;

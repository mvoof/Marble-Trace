import {
  bool,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const ABS_SETTINGS = defineSettings('abs', {
  /**
   * Take the widget off the screen on a car with no ABS adjustment in the
   * cockpit. Off, the plate stays where the driver put it and reads `--`, for a
   * fixed layout shared across several cars.
   */
  hideWhenCarHasNoAbs: bool(true),
});

export type AbsWidgetSettings = SettingsOf<typeof ABS_SETTINGS.shape>;

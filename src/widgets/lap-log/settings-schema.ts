import {
  bool,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const LAP_LOG_SETTINGS = defineSettings('lapLog', {
  /**
   * The delta column drawn as a bar of the time lost to the best lap, the
   * delta written over it, instead of a chip.
   */
  paceLossBars: bool(false),
});

export type LapLogWidgetSettings = SettingsOf<typeof LAP_LOG_SETTINGS.shape>;

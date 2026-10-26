import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const RADIO_SETTINGS = defineSettings('radio', {
  /**
   * The speaker's name as the session gives it, or the first name and the
   * initial of the last ("Max V."), which fits a narrow plate.
   */
  nameFormat: choice(['full', 'short'], 'full'),
  /** The tab in the top-right corner naming who the transmission reaches. */
  showChannel: bool(true),
  /**
   * Show the new channel for a moment after the player switches, so it can
   * be read before talking on it.
   */
  showOnRetune: bool(true),
  /**
   * Keep the widget on screen while nobody talks, showing the channel the
   * player's radio is tuned to. Off, the widget appears only for a voice.
   */
  idleShowsChannel: bool(false),
});

export type RadioWidgetSettings = SettingsOf<typeof RADIO_SETTINGS.shape>;

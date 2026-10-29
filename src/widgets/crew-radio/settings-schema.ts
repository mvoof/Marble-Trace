import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const CREW_RADIO_SETTINGS = defineSettings('crewRadio', {
  /**
   * The line being said alone, or the last few of the exchange, so the
   * question stays on screen under its answer.
   */
  history: choice(['current', 'recent'], 'current'),
  /** How many lines the recent history keeps on screen. */
  recentCount: num(3, { min: 2, max: 6, step: 1 }),
  /** Leave out what the driver said, and with it the ✓ / ✗ of a command. */
  hideDriverLines: bool(false),
});

export type CrewRadioWidgetSettings = SettingsOf<
  typeof CREW_RADIO_SETTINGS.shape
>;

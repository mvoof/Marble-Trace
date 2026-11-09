import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/** When a part of the log shows: always, once it has a time, or never. */
const VISIBILITY = ['always', 'withTime', 'never'] as const;

export const LAP_LOG_SETTINGS = defineSettings('lapLog', {
  /**
   * The delta column drawn as a bar of the time lost to the best lap, the
   * delta written over it, instead of a chip.
   */
  paceLossBars: bool(false),
  /** The BEST chip in the header. */
  bestLapChip: choice(VISIBILITY, 'always'),
  /** The AVG VALID footer. */
  averageFooter: choice(VISIBILITY, 'always'),
});

export type LapLogWidgetSettings = SettingsOf<typeof LAP_LOG_SETTINGS.shape>;

export type LapLogVisibility = (typeof VISIBILITY)[number];

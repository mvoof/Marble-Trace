import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';
import { ROW_PADDING } from '@shared/contracts/widget-choices';

/** When a part of the log shows: always, once it has a time, or never. */
const VISIBILITY = ['always', 'withTime', 'never'] as const;

export const LAP_LOG_SETTINGS = defineSettings('lapLog', {
  /**
   * The delta column drawn as a bar of the time lost to the best lap, the
   * delta written over it, instead of a chip.
   */
  /** The delta column; without it the widget is the lap and time columns alone. */
  showDelta: bool(true),
  paceLossBars: bool(false),
  /** How tall a lap row is — the tables' three steps; the mockup's is wide. */
  rowPadding: choice(ROW_PADDING, 'wide'),
  /** The BEST chip in the header. */
  bestLapChip: choice(VISIBILITY, 'always'),
  /** The AVG VALID footer. */
  averageFooter: choice(VISIBILITY, 'always'),
});

export type LapLogWidgetSettings = SettingsOf<typeof LAP_LOG_SETTINGS.shape>;

export type LapLogVisibility = (typeof VISIBILITY)[number];

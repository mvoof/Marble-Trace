import { LAP_COUNTER } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const TIMER_SETTINGS = defineSettings('timer', {
  showSessionType: bool(true),
  showLaps: bool(true),
  /** Whose lap the footer counts: the race's (the leader's) or the player's. */
  lapCounter: choice(LAP_COUNTER, 'session', { label: 'common.lapCounter' }),
  showPosition: bool(true),
  /** Source of the position shown in the footer. */
  useLivePositions: bool(true, { label: 'common.useLivePositions' }),
  /** Count the footer position within the player's own class instead of the whole field, in multiclass sessions. */
  classPositionInMulticlass: bool(true, {
    label: 'common.classPositionInMulticlass',
  }),
  showWallClock: bool(true),
  showSimTime: bool(true),
  showPcDate: bool(false),
  showSimDate: bool(true),
});

export type TimerWidgetSettings = SettingsOf<typeof TIMER_SETTINGS.shape>;

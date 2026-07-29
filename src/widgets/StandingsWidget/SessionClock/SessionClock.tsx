import { observer } from 'mobx-react-lite';

import { isSessionEnded, splitTime } from '@utils/widget/timer-utils';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './SessionClock.module.scss';

export const SessionClock = observer(() => {
  const { session } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showSessionTime) {
    return null;
  }

  const sessionState = session?.session_state ?? null;

  if (isSessionEnded(sessionState)) {
    return <span className={styles.sessionClock}>END</span>;
  }

  const remain = session?.session_time_remain ?? null;
  const elapsed = session?.session_time ?? null;

  const isCountdown = remain !== null && remain >= 0;
  const rawSeconds = isCountdown ? (remain ?? 0) : (elapsed ?? 0);

  const { main, secs } = splitTime(rawSeconds);

  return <span className={styles.sessionClock}>{`${main}${secs}`}</span>;
});

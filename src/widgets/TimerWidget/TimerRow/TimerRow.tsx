import { observer } from 'mobx-react-lite';

import { useWallClock } from '@hooks/widget/useWallClock';
import { formatSimDate, formatSimTime } from '@utils/widget/timer-utils';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { TimerWidgetSettings } from '@/types/widget-settings';

import { TimerItem } from '../TimerItem/TimerItem';
import styles from './TimerRow.module.scss';
import {
  NO_DATE_DATA_PLACEHOLDER,
  NO_TIME_DATA_PLACEHOLDER,
} from '@utils/constants/data-placeholders';

export const TimerRow = observer(() => {
  const { session, sessionInfo } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showWallClock, showSimTime, showPcDate, showSimDate } =
    widgetSettings.getSettings<TimerWidgetSettings>('timer');

  const wallClock = useWallClock();

  const rawSimTime = session?.session_time_of_day ?? null;
  const simTime =
    rawSimTime !== null ? formatSimTime(rawSimTime) : NO_TIME_DATA_PLACEHOLDER;

  const rawSimDate = sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;

  const simDate =
    rawSimDate !== null ? formatSimDate(rawSimDate) : NO_DATE_DATA_PLACEHOLDER;

  const showTimeRow = showWallClock || showSimTime;
  const showDateRow = showPcDate || showSimDate;

  if (!showTimeRow && !showDateRow) {
    return null;
  }

  return (
    <>
      {showTimeRow && (
        <div className={styles.clockRow}>
          {showWallClock && <TimerItem label="PC">{wallClock.time}</TimerItem>}

          {showSimTime && (
            <TimerItem label="SIM" align={showWallClock ? 'right' : 'left'}>
              {simTime}
            </TimerItem>
          )}
        </div>
      )}

      {showDateRow && (
        <div className={styles.clockRow}>
          {showPcDate && <TimerItem label="DATE">{wallClock.date}</TimerItem>}

          {showSimDate && (
            <TimerItem label="SIM DATE" align={showPcDate ? 'right' : 'left'}>
              {simDate}
            </TimerItem>
          )}
        </div>
      )}
    </>
  );
});

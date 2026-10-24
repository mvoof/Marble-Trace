import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { useWallClock } from '../useWallClock';
import { formatSimDate, formatSimTime } from '@shared/lib/timer-utils';
import { useSessionStore } from '@entities/session/session-context';

import { TimerItem } from '../TimerItem/TimerItem';
import styles from './TimerRow.module.scss';
import {
  NO_DATE_DATA_PLACEHOLDER,
  NO_TIME_DATA_PLACEHOLDER,
} from '@shared/lib/telemetry-format';
import type { TimerWidgetSettings } from '../settings-schema';

export const TimerRow = observer(() => {
  const { session, sessionInfo } = useSessionStore();

  const { showWallClock, showSimTime, showPcDate, showSimDate } =
    useWidgetSettings<TimerWidgetSettings>('timer');

  const wallClock = useWallClock();

  const rawSimTime = session?.session_time_of_day ?? null;
  const simTime =
    rawSimTime !== null ? formatSimTime(rawSimTime) : NO_TIME_DATA_PLACEHOLDER;

  const rawSimDate = sessionInfo?.weekendDate || null;

  const simDate =
    rawSimDate !== null ? formatSimDate(rawSimDate) : NO_DATE_DATA_PLACEHOLDER;

  const hasPcColumn = showWallClock || showPcDate;
  const hasSimColumn = showSimTime || showSimDate;

  if (!hasPcColumn && !hasSimColumn) {
    return null;
  }

  const hasTwoColumns = hasPcColumn && hasSimColumn;
  const gridClassName = hasTwoColumns
    ? `${styles.clockGrid} ${styles.twoColumns}`
    : styles.clockGrid;
  const dateRowClassName =
    showWallClock || showSimTime ? styles.secondRow : styles.firstRow;
  const pcCellClassName = `${styles.cell} ${styles.pcColumn}`;
  const simCellClassName = `${styles.cell} ${styles.simColumn}`;

  return (
    <div className={gridClassName}>
      {showWallClock && (
        <span className={`${pcCellClassName} ${styles.firstRow}`}>
          <TimerItem label="PC">{wallClock.time}</TimerItem>
        </span>
      )}

      {showPcDate && (
        <span className={`${pcCellClassName} ${dateRowClassName}`}>
          <TimerItem label="DATE" variant="date">
            {wallClock.date}
          </TimerItem>
        </span>
      )}

      {showSimTime && (
        <span className={`${simCellClassName} ${styles.firstRow}`}>
          <TimerItem label="SIM">{simTime}</TimerItem>
        </span>
      )}

      {showSimDate && (
        <span className={`${simCellClassName} ${dateRowClassName}`}>
          <TimerItem label="SIM DATE" variant="date">
            {simDate}
          </TimerItem>
        </span>
      )}
    </div>
  );
});

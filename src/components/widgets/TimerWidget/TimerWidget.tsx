import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { SessionState as BindingSessionState } from '../../../types/bindings';
import { resolveSessionLaps } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';

import styles from './TimerWidget.module.scss';

export type FlagState = 'green' | 'final' | 'checkered';

const FLAG_LABEL: Record<FlagState, string> = {
  green: 'GREEN',
  final: 'FINAL 5 MIN',
  checkered: 'CHECKERED',
};

const FLAG_CLASS: Record<FlagState, string> = {
  green: styles.flagGreen,
  final: styles.flagFinal,
  checkered: styles.flagCheckered,
};

const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;
const FINAL_FLAG_THRESHOLD_SEC = 300;
const SESSION_FLAG_CHECKERED = 0x0001;
const WALL_CLOCK_INTERVAL_MS = 1000;

const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const MONTH_NAME_TO_IDX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const formatWallClock = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const formatPcDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

const formatSimDate = (raw: string): string => {
  const parsed = new Date(raw);

  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');

    return `${day} ${MONTH_ABBR[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  const parts = raw.trim().split(/\s+/);

  if (parts.length >= 3) {
    const year = parts[0];
    const monthIdx = MONTH_NAME_TO_IDX[parts[1].toLowerCase()];
    const day = parts[2].padStart(2, '0');

    if (monthIdx !== undefined) {
      return `${day} ${MONTH_ABBR[monthIdx]} ${year}`;
    }
  }

  return raw;
};

const formatSimTime = (secondsSinceMidnight: number): string => {
  const total = Math.round(secondsSinceMidnight);
  const hours = String(Math.floor(total / SECONDS_IN_HOUR)).padStart(2, '0');
  const minutes = String(
    Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
  ).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const resolveFlagState = (
  flags: number | null,
  remainSeconds: number | null
): FlagState => {
  if (flags !== null && (flags & SESSION_FLAG_CHECKERED) !== 0) {
    return 'checkered';
  }

  if (
    remainSeconds !== null &&
    remainSeconds >= 0 &&
    remainSeconds < FINAL_FLAG_THRESHOLD_SEC
  ) {
    return 'final';
  }

  return 'green';
};

const isSessionEnded = (sessionState: BindingSessionState | null): boolean => {
  if (sessionState === null) {
    return false;
  }

  return sessionState === 'Checkered' || sessionState === 'CoolDown';
};

const splitTime = (seconds: number): { main: string; secs: string } => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = String(Math.floor(total / SECONDS_IN_HOUR)).padStart(2, '0');
  const minutes = String(
    Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
  ).padStart(2, '0');
  const secs = String(total % SECONDS_IN_MINUTE).padStart(2, '0');

  return { main: `${hours}:${minutes}:`, secs };
};

const formatLapCount = (
  current: number | null,
  total: string | null
): string => {
  const currentLabel = current !== null ? current : '—';
  const totalLabel = total && total.toLowerCase() !== 'unlimited' ? total : '∞';

  return `LAP ${currentLabel}/${totalLabel}`;
};

const formatPosition = (
  position: number | null,
  total: number | null
): string => {
  if (position === null) {
    return 'POS —';
  }

  const totalLabel = total !== null ? `/${total}` : '';

  return `POS P${position}${totalLabel}`;
};

export const TimerWidget = observer(() => {
  const [wallClock, setWallClock] = useState(() => ({
    time: formatWallClock(new Date()),
    date: formatPcDate(new Date()),
  }));

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      setWallClock({
        time: formatWallClock(now),
        date: formatPcDate(now),
      });
    }, WALL_CLOCK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const lap = telemetryStore.lapTiming;

  const {
    showFlag,
    showLaps,
    showPosition,
    showWallClock,
    showSimTime,
    showPcDate,
    showSimDate,
  } = widgetSettingsStore.getTimerSettings();

  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;
  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'SESSION';

  const remain = session?.session_time_remain ?? null;
  const elapsed = session?.session_time ?? null;
  const isCountdown = remain !== null && remain >= 0;
  const rawSeconds = isCountdown ? (remain ?? 0) : (elapsed ?? 0);
  const { main: timeMain, secs: timeSeconds } = splitTime(rawSeconds);

  const flagState = resolveFlagState(session?.session_flags ?? null, remain);
  const sessionEnded = isSessionEnded(session?.session_state ?? null);

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;

  const totalLaps =
    sessionNum !== null
      ? resolveSessionLaps(
          currentSession?.SessionLaps,
          remain,
          currentLap,
          telemetryStore.leaderBestLapTime
        )
      : null;

  const position = lap?.player_car_position ?? null;
  const totalDrivers = driverInfo?.Drivers?.length ?? null;

  const rawSimTime = session?.session_time_of_day ?? null;
  const simTime = rawSimTime !== null ? formatSimTime(rawSimTime) : null;

  const rawSimDate =
    telemetryStore.sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;
  const simDate = rawSimDate !== null ? formatSimDate(rawSimDate) : null;

  const showFooter = showLaps || showPosition;
  const showClockRow = showWallClock || showSimTime;
  const showDateRow = showPcDate || showSimDate;

  if (sessionEnded) {
    return (
      <WidgetPanel direction="column" gap={0} minWidth={180}>
        <div className={styles.header}>
          <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
        </div>

        <div className={styles.timeDisplay}>
          <span className={styles.sessionEndedLabel}>END</span>
        </div>

        {showClockRow && (
          <div className={styles.clockRow}>
            {showWallClock && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>PC</span>
                {wallClock.time}
              </span>
            )}

            {showSimTime && simTime !== null && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>SIM</span>
                {simTime}
              </span>
            )}
          </div>
        )}

        {showDateRow && (
          <div className={styles.clockRow}>
            {showPcDate && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>DATE</span>
                {wallClock.date}
              </span>
            )}

            {showSimDate && simDate !== null && (
              <span className={styles.clockItem}>
                <span className={styles.clockLabel}>SIM</span>
                {simDate}
              </span>
            )}
          </div>
        )}
      </WidgetPanel>
    );
  }

  return (
    <WidgetPanel direction="column" gap={0} minWidth={180}>
      <div className={styles.header}>
        <span className={styles.sessionLabel}>{sessionTypeLabel}</span>
        {showFlag && (
          <span className={`${styles.flagLabel} ${FLAG_CLASS[flagState]}`}>
            ● {FLAG_LABEL[flagState]}
          </span>
        )}
      </div>

      <div className={styles.timeDisplay}>
        <span className={styles.timeMain}>{timeMain}</span>
        <span className={styles.timeSeconds}>{timeSeconds}</span>
      </div>

      {showClockRow && (
        <div className={styles.clockRow}>
          {showWallClock && (
            <span className={styles.clockItem}>
              <span className={styles.clockLabel}>PC</span>
              {wallClock.time}
            </span>
          )}

          {showSimTime && simTime !== null && (
            <span className={styles.clockItem}>
              <span className={styles.clockLabel}>SIM</span>
              {simTime}
            </span>
          )}
        </div>
      )}

      {showDateRow && (
        <div className={styles.clockRow}>
          {showPcDate && (
            <span className={styles.clockItem}>
              <span className={styles.clockLabel}>DATE</span>
              {wallClock.date}
            </span>
          )}

          {showSimDate && simDate !== null && (
            <span className={styles.clockItem}>
              <span className={styles.clockLabel}>SIM</span>
              {simDate}
            </span>
          )}
        </div>
      )}

      {showFooter && (
        <div className={styles.footer}>
          {showLaps && (
            <span className={styles.footerItem}>
              {formatLapCount(currentLap, totalLaps)}
            </span>
          )}

          {showPosition && (
            <span className={styles.footerItem}>
              {formatPosition(position, totalDrivers)}
            </span>
          )}
        </div>
      )}
    </WidgetPanel>
  );
});

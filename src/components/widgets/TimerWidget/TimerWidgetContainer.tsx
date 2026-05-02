import { useEffect, useState } from 'react';

import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import { SessionState as BindingSessionState } from '../../../types/bindings';
import type { FlagState } from './TimerWidget';
import { TimerWidget } from './TimerWidget';

const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;

const formatWallClock = (date: Date): string => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

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

const formatSimDate = (raw: string): string => {
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${d} ${MONTH_ABBR[parsed.getMonth()]} ${parsed.getFullYear()}`;
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

const formatPcDate = (date: Date): string => {
  const d = String(date.getDate()).padStart(2, '0');
  const mo = MONTH_ABBR[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${mo} ${y}`;
};

const formatSimTime = (secondsSinceMidnight: number): string => {
  const total = Math.round(secondsSinceMidnight);
  const h = String(Math.floor(total / SECONDS_IN_HOUR)).padStart(2, '0');
  const m = String(
    Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
  ).padStart(2, '0');
  return `${h}:${m}`;
};

const SESSION_FLAG_CHECKERED = 0x0001;

const resolveFlagState = (
  flags: number | null,
  remainSeconds: number | null
): FlagState => {
  if (flags !== null && (flags & SESSION_FLAG_CHECKERED) !== 0)
    return 'checkered';
  if (remainSeconds !== null && remainSeconds >= 0 && remainSeconds < 300)
    return 'final';
  return 'green';
};

const isSessionEnded = (sessionState: BindingSessionState | null): boolean => {
  if (sessionState === null) return false;
  return sessionState === 'Checkered' || sessionState === 'CoolDown';
};

const splitTime = (seconds: number): { main: string; secs: string } => {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return { main: `${h}:${m}:`, secs: s };
};

export const TimerWidgetContainer = observer(() => {
  const [wallClockTime, setWallClockTime] = useState(() =>
    formatWallClock(new Date())
  );
  const [pcDate, setPcDate] = useState(() => formatPcDate(new Date()));

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setWallClockTime(formatWallClock(now));
      setPcDate(formatPcDate(now));
    }, 1000);
    return () => clearInterval(id);
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

  const widgetRef = useAutoSizeWidget('timer');

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
  const sessionEndedFlag = isSessionEnded(session?.session_state ?? null);

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null ? (currentSession?.SessionLaps ?? null) : null;

  const position = lap?.player_car_position ?? null;
  const totalDrivers = driverInfo?.Drivers?.length ?? null;

  const rawSimTime = session?.session_time_of_day ?? null;
  const simTime = rawSimTime !== null ? formatSimTime(rawSimTime) : null;

  const rawSimDate =
    telemetryStore.sessionInfo?.WeekendInfo?.WeekendOptions?.Date ?? null;
  const simDate = rawSimDate !== null ? formatSimDate(rawSimDate) : null;

  return (
    <TimerWidget
      ref={widgetRef}
      sessionTypeLabel={sessionTypeLabel}
      flagState={flagState}
      timeMain={timeMain}
      timeSeconds={timeSeconds}
      currentLap={currentLap}
      totalLaps={totalLaps}
      position={position}
      totalDrivers={totalDrivers}
      sessionEnded={sessionEndedFlag}
      showFlag={showFlag}
      showLaps={showLaps}
      showPosition={showPosition}
      showWallClock={showWallClock}
      showSimTime={showSimTime}
      showPcDate={showPcDate}
      showSimDate={showSimDate}
      wallClockTime={wallClockTime}
      simTime={simTime}
      pcDate={pcDate}
      simDate={simDate}
    />
  );
});

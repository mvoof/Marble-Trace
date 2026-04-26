import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useAutoSizeWidget } from '../../../hooks/useAutoSizeWidget';
import type { FlagState } from './TimerWidget';
import { TimerWidget } from './TimerWidget';

const SESSION_FLAG_CHECKERED = 0x0001;
const SESSION_STATE_CHECKERED = 6;
const SESSION_STATE_COOL_DOWN = 7;

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

const isSessionEnded = (sessionState: number | null): boolean => {
  if (sessionState === null) return false;
  return (
    sessionState === SESSION_STATE_CHECKERED ||
    sessionState === SESSION_STATE_COOL_DOWN
  );
};

const splitTime = (seconds: number): { main: string; secs: string } => {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return { main: `${h}:${m}:`, secs: s };
};

export const TimerWidgetContainer = observer(() => {
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const lap = telemetryStore.lapTiming;

  const { showFlag, showLaps, showPosition } =
    widgetSettingsStore.getTimerSettings();

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
    />
  );
});

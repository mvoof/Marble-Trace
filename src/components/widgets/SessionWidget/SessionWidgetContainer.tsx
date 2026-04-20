import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { formatSessionTime } from '../../../utils/telemetry-format';
import { SessionWidget } from './SessionWidget';

export const SessionWidgetContainer = observer(() => {
  const session = telemetryStore.session;
  const lapTiming = telemetryStore.lapTiming;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;

  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'SESSION';
  const sessionLaps = currentSession?.SessionLaps ?? 'unlimited';
  const isLapBased = sessionLaps !== 'unlimited' && !isNaN(Number(sessionLaps));

  let contextLabel: string;
  let contextValue: string;

  if (isLapBased) {
    const currentLap = lapTiming?.lap ?? 0;
    contextLabel = 'LAP';
    contextValue = `${currentLap} / ${sessionLaps}`;
  } else {
    const remain = session?.session_time_remain ?? null;
    const elapsed = session?.session_time ?? null;
    const isCountdown = remain !== null && remain >= 0;

    if (isCountdown) {
      contextLabel = 'TIME REMAINING';
      contextValue = formatSessionTime(remain);
    } else {
      contextLabel = 'TIME ELAPSED';
      contextValue = formatSessionTime(elapsed);
    }
  }

  return (
    <SessionWidget
      sessionTypeLabel={sessionTypeLabel}
      contextLabel={contextLabel}
      contextValue={contextValue}
    />
  );
});

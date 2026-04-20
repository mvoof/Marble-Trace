import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { formatSessionTime } from '../../../utils/telemetry-format';
import { TimerWidget } from './TimerWidget';

export const TimerWidgetContainer = observer(() => {
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;
  const currentSession =
    sessionNum !== null ? (sessions[sessionNum] ?? null) : null;

  const sessionTypeLabel =
    currentSession?.SessionType?.toUpperCase() ?? 'SESSION';

  const remain = session?.session_time_remain ?? null;
  const elapsed = session?.session_time ?? null;
  const isCountdown = remain !== null && remain >= 0;

  const displayTime = formatSessionTime(isCountdown ? remain : elapsed);

  return (
    <TimerWidget
      displayTime={displayTime}
      sessionTypeLabel={sessionTypeLabel}
      isCountdown={isCountdown}
    />
  );
});

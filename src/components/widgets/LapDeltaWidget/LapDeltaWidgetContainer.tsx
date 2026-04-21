import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const session = telemetryStore.session;
  const sessions = telemetryStore.sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;

  const current = lap?.lap_current_lap_time ?? null;
  const best = lap?.lap_best_lap_time ?? null;
  const hasDelta = current !== null && best !== null && best > 0;
  const delta = hasDelta ? current - best : null;

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null ? (sessions[sessionNum]?.SessionLaps ?? null) : null;

  return (
    <LapDeltaWidget
      deltaFormatted={formatDelta(delta)}
      deltaState={getDeltaState(delta)}
      currentLap={currentLap}
      totalLaps={totalLaps}
      s1Delta={null}
      s2Delta={null}
      s3Delta={null}
    />
  );
});

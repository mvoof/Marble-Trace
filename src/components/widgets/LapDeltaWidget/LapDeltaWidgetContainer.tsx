import { observer } from 'mobx-react-lite';

import { computedStore, telemetryStore } from '../../../store/iracing';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const session = telemetryStore.session;
  const sessionInfo = telemetryStore.sessionInfo;
  const sessions = sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;

  const delta = computedStore.lapDelta?.totalDelta ?? 0;

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null ? (sessions[sessionNum]?.SessionLaps ?? null) : null;

  const sectorDeltas = computedStore.lapDelta?.sectorDeltas ?? [];

  return (
    <LapDeltaWidget
      deltaFormatted={formatDelta(delta)}
      deltaState={getDeltaState(delta)}
      currentLap={currentLap}
      totalLaps={totalLaps}
      sectorDeltas={sectorDeltas}
    />
  );
});

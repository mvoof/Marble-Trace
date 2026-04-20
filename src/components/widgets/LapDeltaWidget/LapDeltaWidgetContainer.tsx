import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { formatLapTime } from '../../../utils/telemetry-format';
import { formatDelta, deltaBarPct, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

export const LapDeltaWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;

  const current = lap?.lap_current_lap_time ?? null;
  const best = lap?.lap_best_lap_time ?? null;
  const hasDelta = current !== null && best !== null && best > 0;
  const delta = hasDelta ? current - best : null;

  return (
    <LapDeltaWidget
      deltaFormatted={formatDelta(delta)}
      deltaState={getDeltaState(delta)}
      barPct={deltaBarPct(delta)}
      bestLapFormatted={formatLapTime(best)}
      hasDelta={hasDelta}
    />
  );
});

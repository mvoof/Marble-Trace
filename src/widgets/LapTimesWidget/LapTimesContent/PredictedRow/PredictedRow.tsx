import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';

const COLOR_PREDICTED = '#fbbf24';

export const PredictedRow = observer(() => {
  const settings = widgetSettingsStore.getLapTimesSettings();

  if (!settings.showPredicted) {
    return null;
  }

  const bestLap = telemetryStore.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computedStore.lapDelta?.personalBestTotal ?? null;

  const predictedLap =
    bestLap !== null && bestLap > 0 && liveDelta !== null
      ? bestLap + liveDelta
      : null;

  const isHorizontal = settings.layout === 'horizontal';

  return (
    <TimingRow
      label="PRED"
      time={formatLapTime(predictedLap)}
      delta=""
      accentColor={COLOR_PREDICTED}
      fill={isHorizontal}
    />
  );
});

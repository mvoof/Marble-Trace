import { observer } from 'mobx-react-lite';

import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { LAP_TIME_COLORS } from '@utils/widget/lap-times-utils';
import {
  useComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const PredictedRow = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getLapTimesSettings();

  if (!settings.showPredicted) {
    return null;
  }

  const bestLap = telemetry.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computed.lapDelta?.personalBestTotal ?? null;

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
      accentColor={LAP_TIME_COLORS.predicted}
      fill={isHorizontal}
    />
  );
});

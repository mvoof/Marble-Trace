import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { formatDelta, getDeltaColor } from '@utils/widget/lap-times-utils';

const COLOR_BEST = 'rgba(192, 132, 252, 0.85)';

export const BestLapRow = observer(() => {
  const settings = widgetSettingsStore.getLapTimesSettings();

  if (!settings.showBestLap) {
    return null;
  }

  const bestLap = telemetryStore.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computedStore.lapDelta?.personalBestTotal ?? null;

  const isHorizontal = settings.layout === 'horizontal';

  return (
    <TimingRow
      label="BEST"
      time={formatLapTime(bestLap)}
      delta={formatDelta(liveDelta)}
      accentColor={COLOR_BEST}
      deltaColor={getDeltaColor(liveDelta)}
      fill={isHorizontal}
    />
  );
});

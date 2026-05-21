import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { formatDelta, getDeltaColor } from '@utils/widget/lap-times-utils';

const COLOR_LAST = '#ef4444';

export const LastLapRow = observer(() => {
  const settings = widgetSettingsStore.getLapTimesSettings();

  if (!settings.showLastLap) {
    return null;
  }

  const lastLap = telemetryStore.lapTiming?.lap_last_lap_time ?? null;
  const bestLap = telemetryStore.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computedStore.lapDelta?.personalBestTotal ?? null;

  const lastDelta =
    liveDelta !== null && bestLap !== null && lastLap !== null
      ? liveDelta + (bestLap - lastLap)
      : null;

  const isHorizontal = settings.layout === 'horizontal';

  return (
    <TimingRow
      label="LAST"
      time={formatLapTime(lastLap)}
      delta={formatDelta(lastDelta)}
      accentColor={COLOR_LAST}
      deltaColor={getDeltaColor(lastDelta)}
      fill={isHorizontal}
    />
  );
});

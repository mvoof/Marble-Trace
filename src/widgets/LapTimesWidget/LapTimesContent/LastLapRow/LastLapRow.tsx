import { observer } from 'mobx-react-lite';

import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import {
  formatDelta,
  getDeltaColor,
  LAP_TIME_COLORS,
} from '@utils/widget/lap-times-utils';
import {
  useBackendComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';

export const LastLapRow = observer(() => {
  const computed = useBackendComputedStore();
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  if (!settings.showLastLap) {
    return null;
  }

  const lastLap = telemetry.lapTiming?.lap_last_lap_time ?? null;
  const bestLap = telemetry.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computed.lapDelta?.personalBestTotal ?? null;

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
      accentColor={LAP_TIME_COLORS.last}
      deltaColor={getDeltaColor(lastDelta)}
      fill={isHorizontal}
    />
  );
});

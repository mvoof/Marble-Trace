import { observer } from 'mobx-react-lite';

import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import {
  formatDelta,
  getDeltaColor,
  LAP_TIME_COLORS,
} from '@utils/widget/lap-times-utils';
import {
  useComputedStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';

export const BestLapRow = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  if (!settings.showBestLap) {
    return null;
  }

  const bestLap = telemetry.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computed.lapDelta?.personalBestTotal ?? null;

  const isHorizontal = settings.layout === 'horizontal';

  return (
    <TimingRow
      label="BEST"
      time={formatLapTime(bestLap)}
      delta={formatDelta(liveDelta)}
      accentColor={LAP_TIME_COLORS.best}
      deltaColor={getDeltaColor(liveDelta)}
      fill={isHorizontal}
    />
  );
});

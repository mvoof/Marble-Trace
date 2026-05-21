import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { LAP_TIME_COLORS } from '@utils/widget/lap-times-utils';

export const CurrentLapRow = observer(() => {
  const currentLap = telemetryStore.lapTiming?.lap_current_lap_time ?? null;
  const isHorizontal =
    widgetSettingsStore.getLapTimesSettings().layout === 'horizontal';

  return (
    <TimingRow
      label="CURRENT"
      time={formatLapTime(currentLap)}
      delta=""
      accentColor={LAP_TIME_COLORS.current}
      fill={isHorizontal}
    />
  );
});

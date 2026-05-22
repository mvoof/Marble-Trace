import { observer } from 'mobx-react-lite';

import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { LAP_TIME_COLORS } from '@utils/widget/lap-times-utils';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { LapTimesWidgetSettings } from '@/types/widget-settings';

export const CurrentLapRow = observer(() => {
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const currentLap = telemetry.lapTiming?.lap_current_lap_time ?? null;
  const isHorizontal =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times').layout ===
    'horizontal';

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

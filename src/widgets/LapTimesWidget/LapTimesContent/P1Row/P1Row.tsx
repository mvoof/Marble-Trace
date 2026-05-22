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

export const P1Row = observer(() => {
  const computed = useComputedStore();
  const telemetry = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  if (!settings.showP1) {
    return null;
  }

  const bestLap = telemetry.lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = computed.lapDelta?.personalBestTotal ?? null;
  const carIdxData = telemetry.carIdx;
  const standings = computed.standings?.entries ?? [];

  const playerClassId = standings.find((entry) => entry.isPlayer)?.carClassId;
  const classEntries =
    playerClassId !== undefined
      ? standings.filter((entry) => entry.carClassId === playerClassId)
      : [];

  const allBestTimes = carIdxData?.car_idx_best_lap_time ?? [];

  const classBestTimes = classEntries.reduce<number[]>((acc, entry) => {
    const bestTime = allBestTimes[entry.carIdx];

    if (bestTime !== undefined && bestTime > 0) {
      acc.push(bestTime);
    }

    return acc;
  }, []);

  const timesToUse =
    classBestTimes.length > 0
      ? classBestTimes
      : allBestTimes.filter((time) => time > 0);

  const p1Time = timesToUse.length > 0 ? Math.min(...timesToUse) : null;

  const p1Delta =
    liveDelta !== null && bestLap !== null && p1Time !== null
      ? liveDelta + (bestLap - p1Time)
      : null;

  const isHorizontal = settings.layout === 'horizontal';

  return (
    <TimingRow
      label="P1"
      time={formatLapTime(p1Time)}
      delta={formatDelta(p1Delta)}
      accentColor={LAP_TIME_COLORS.p1}
      deltaColor={getDeltaColor(p1Delta)}
      fill={isHorizontal}
    />
  );
});

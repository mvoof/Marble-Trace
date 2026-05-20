import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { formatDelta, getDeltaColor } from '@utils/widget/lap-times-utils';

import styles from './LapTimesWidget.module.scss';

const COLOR_CURRENT = '#22c55e';
const COLOR_PREDICTED = '#fbbf24';
const COLOR_LAST = '#ef4444';
const COLOR_BEST = 'rgba(192, 132, 252, 0.85)';
const COLOR_P1 = 'rgba(238, 238, 238, 0.85)';

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
}

export const LapTimesWidget = observer(() => {
  const lap = telemetryStore.lapTiming;
  const carIdxData = telemetryStore.carIdx;
  const standings = computedStore.standings?.entries ?? [];
  const lapDelta = computedStore.lapDelta;
  const settings = widgetSettingsStore.getLapTimesSettings();

  const currentLap = lap?.lap_current_lap_time ?? null;
  const lastLap = lap?.lap_last_lap_time ?? null;
  const bestLap = lap?.lap_best_lap_time ?? null;

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
  const liveDelta = lapDelta?.personalBestTotal ?? null;

  const predictedLap =
    bestLap !== null && bestLap > 0 && liveDelta !== null
      ? bestLap + liveDelta
      : null;

  const lastDelta =
    liveDelta !== null && bestLap !== null && lastLap !== null
      ? liveDelta + (bestLap - lastLap)
      : null;

  const p1Delta =
    liveDelta !== null && bestLap !== null && p1Time !== null
      ? liveDelta + (bestLap - p1Time)
      : null;

  const isHorizontal = settings.layout === 'horizontal';

  const rows: RowConfig[] = [
    {
      label: 'CURRENT',
      time: formatLapTime(currentLap),
      delta: '',
      accentColor: COLOR_CURRENT,
    },
  ];

  if (settings.showPredicted) {
    rows.push({
      label: 'PRED',
      time: formatLapTime(predictedLap),
      delta: '',
      accentColor: COLOR_PREDICTED,
    });
  }

  if (settings.showLastLap) {
    rows.push({
      label: 'LAST',
      time: formatLapTime(lastLap),
      delta: formatDelta(lastDelta),
      accentColor: COLOR_LAST,
      deltaColor: getDeltaColor(lastDelta),
    });
  }

  if (settings.showBestLap) {
    rows.push({
      label: 'BEST',
      time: formatLapTime(bestLap),
      delta: formatDelta(liveDelta),
      accentColor: COLOR_BEST,
      deltaColor: getDeltaColor(liveDelta),
    });
  }

  if (settings.showP1) {
    rows.push({
      label: 'P1',
      time: formatLapTime(p1Time),
      delta: formatDelta(p1Delta),
      accentColor: COLOR_P1,
      deltaColor: getDeltaColor(p1Delta),
    });
  }

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      <div
        className={
          isHorizontal ? styles.rowListHorizontal : styles.rowListVertical
        }
      >
        {rows.map((row) => (
          <TimingRow
            key={row.label}
            label={row.label}
            time={row.time}
            delta={row.delta}
            accentColor={row.accentColor}
            deltaColor={row.deltaColor}
            fill={isHorizontal}
          />
        ))}
      </div>
    </WidgetPanel>
  );
});

import { observer } from 'mobx-react-lite';

import { TimingRow } from '@/components/shared/TimingRow/TimingRow';
import { formatLapTime } from '@utils/formatters/telemetry-format';
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
import styles from './LapTimesContent.module.scss';

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
}

export const LapTimesContent = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const { p1LapTime, lapDelta } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');
  const isHorizontal = settings.layout === 'horizontal';

  const currentLap = lapTiming?.lap_current_lap_time ?? null;
  const lastLap = lapTiming?.lap_last_lap_time ?? null;
  const bestLap = lapTiming?.lap_best_lap_time ?? null;
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
    liveDelta !== null && bestLap !== null && p1LapTime !== null
      ? liveDelta + (bestLap - p1LapTime)
      : null;

  const rows: RowConfig[] = [
    {
      label: 'CURRENT',
      time: formatLapTime(currentLap),
      delta: '',
      accentColor: LAP_TIME_COLORS.current,
    },
    ...((settings.showPredicted ?? true)
      ? [
          {
            label: 'PRED',
            time: formatLapTime(predictedLap),
            delta: '',
            accentColor: LAP_TIME_COLORS.predicted,
          },
        ]
      : []),
    ...(settings.showLastLap
      ? [
          {
            label: 'LAST',
            time: formatLapTime(lastLap),
            delta: formatDelta(lastDelta),
            accentColor: LAP_TIME_COLORS.last,
            deltaColor: getDeltaColor(lastDelta),
          },
        ]
      : []),
    ...(settings.showBestLap
      ? [
          {
            label: 'BEST',
            time: formatLapTime(bestLap),
            delta: formatDelta(liveDelta),
            accentColor: LAP_TIME_COLORS.best,
            deltaColor: getDeltaColor(liveDelta),
          },
        ]
      : []),
    ...(settings.showP1
      ? [
          {
            label: 'P1',
            time: formatLapTime(p1LapTime),
            delta: formatDelta(p1Delta),
            accentColor: LAP_TIME_COLORS.p1,
            deltaColor: getDeltaColor(p1Delta),
          },
        ]
      : []),
  ];

  return (
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
  );
});

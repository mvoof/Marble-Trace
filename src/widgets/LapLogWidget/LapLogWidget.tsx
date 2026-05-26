import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useDeltaStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
} from '@utils/widget/delta-utils';
import type {
  LapDeltaReference,
  LapLogWidgetSettings,
} from '@/types/widget-settings';
import { LapRow } from './LapRow/LapRow';
import styles from './LapLogWidget.module.scss';

// TODO: use style class and variables
const DELTA_COLORS = {
  ahead: '#22c55e',
  behind: '#ef4444',
  neutral: '#fbbf24',
};

const HISTORY_STORE_SIZE = 12;
const HISTORY_SHOW_SIZE = 8;

interface HistoryEntry {
  lapNum: number;
  lapTime: number;
  delta: number | null;
  reference: LapDeltaReference;
  isBest: boolean;
}

export const LapLogWidget = observer(() => {
  const lapStore = useDeltaStore();
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<LapLogWidgetSettings>('lap-log');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const prevCompletedLapNumRef = useRef<number | null>(null);

  const lap = lapStore.lastCompletedLap;

  useEffect(() => {
    if (lap === null) {
      setHistory([]);
      prevCompletedLapNumRef.current = null;
      return;
    }

    if (prevCompletedLapNumRef.current === lap.lapNum) return;

    prevCompletedLapNumRef.current = lap.lapNum;

    const entry: HistoryEntry = {
      lapNum: lap.lapNum,
      lapTime: lap.lapTime,
      delta: lap.deltas[reference],
      reference,
      isBest: lap.isBest,
    };

    setHistory((prev) => {
      const prevEntries = entry.isBest
        ? prev.map((e) => ({ ...e, isBest: false }))
        : prev;

      return [entry, ...prevEntries].slice(0, HISTORY_STORE_SIZE);
    });
  }, [lap, reference]);

  const lapNum = lapTiming?.lap ?? null;
  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;
  const liveDelta = getGameDelta(lapTiming, reference);

  const visibleHistory = history.slice(0, HISTORY_SHOW_SIZE);

  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>LAP HISTORY</span>

        <div className={styles.headerBest}>
          <span className={styles.headerBestLabel}>BEST</span>

          <span className={styles.headerBestTime}>
            {formatLapTime(bestLapTime)}
          </span>
        </div>
      </div>

      <LapRow
        lapLabel={`L${lapNum ?? '--'}`}
        time={formatLapTime(currentLapTime)}
        deltaLabel={formatDelta(liveDelta)}
        deltaColor={DELTA_COLORS[getDeltaState(liveDelta)]}
        isLive
        reference={reference}
      />

      {visibleHistory.map((entry) => (
        <LapRow
          key={entry.lapNum}
          lapLabel={`L${entry.lapNum}`}
          time={formatLapTime(entry.lapTime)}
          deltaLabel={entry.isBest ? '★ BEST' : formatDelta(entry.delta)}
          deltaColor={
            entry.isBest
              ? 'rgba(192, 132, 252, 0.85)' // TODO: use style class and variables
              : entry.delta !== null
                ? DELTA_COLORS[getDeltaState(entry.delta)]
                : undefined
          }
          isBest={entry.isBest}
          reference={entry.reference}
        />
      ))}
    </WidgetPanel>
  );
});

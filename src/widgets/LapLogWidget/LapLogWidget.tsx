import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import {
  formatDelta,
  getDeltaState,
  getGameDelta,
} from '@utils/widget/delta-utils';
import type { LapLogWidgetSettings } from '@/types/widget-settings';
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
  isBest: boolean;
}

export const LapLogWidget = observer(() => {
  const { lapTiming, session } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<LapLogWidgetSettings>('lap-log');

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const prevSessionNumRef = useRef<number | null>(null);
  const prevLapNumRef = useRef<number | null>(null);
  const prevLastLapTimeRef = useRef<number | null>(null);
  const lapTimingRef = useRef(lapTiming);

  lapTimingRef.current = lapTiming;

  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const lapNum = lapTiming?.lap ?? null;
  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;
  const sessionNum = session?.session_num ?? null;

  useEffect(() => {
    if (sessionNum === null) return;

    if (
      prevSessionNumRef.current !== null &&
      sessionNum !== prevSessionNumRef.current
    ) {
      setHistory([]);
      prevLastLapTimeRef.current = null;
      prevLapNumRef.current = null;
    }

    prevSessionNumRef.current = sessionNum;
  }, [sessionNum]);

  useEffect(() => {
    if (lapNum === null) return;

    if (prevLapNumRef.current !== null && lapNum < prevLapNumRef.current) {
      setHistory([]);
      prevLastLapTimeRef.current = null;
    }

    prevLapNumRef.current = lapNum;
  }, [lapNum]);

  useEffect(() => {
    if (lastLapTime === null || lastLapTime <= 0) return;
    if (prevLastLapTimeRef.current === lastLapTime) return;

    prevLastLapTimeRef.current = lastLapTime;

    const completedLapNum = (lapNum ?? 1) - 1;
    const rawDelta = getGameDelta(lapTimingRef.current, referenceRef.current);
    const currentBest = lapTimingRef.current?.lap_best_lap_time ?? null;
    const entry: HistoryEntry = {
      lapNum: completedLapNum,
      lapTime: lastLapTime,
      delta: rawDelta !== 0 ? rawDelta : null,
      isBest: lastLapTime === currentBest,
    };

    setHistory((prev) =>
      [entry, ...prev.map((e) => ({ ...e, isBest: false }))].slice(
        0,
        HISTORY_STORE_SIZE
      )
    );
  }, [lastLapTime, lapNum]);

  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;

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
        />
      ))}
    </WidgetPanel>
  );
});

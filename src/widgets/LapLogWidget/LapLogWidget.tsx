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
}

export const LapLogWidget = observer(() => {
  const { lapTiming, session } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<LapLogWidgetSettings>('lap-log');

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const prevLapNumRef = useRef<number | null>(null);
  const prevSessionNumRef = useRef<number | null>(null);
  const lapTimingRef = useRef(lapTiming);

  lapTimingRef.current = lapTiming;

  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const lapNum = lapTiming?.lap ?? null;
  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const sessionNum = session?.session_num ?? null;

  useEffect(() => {
    if (sessionNum === null) return;

    if (
      prevSessionNumRef.current !== null &&
      sessionNum !== prevSessionNumRef.current
    ) {
      setHistory([]);
      prevLapNumRef.current = null;
    }

    prevSessionNumRef.current = sessionNum;
  }, [sessionNum]);

  useEffect(() => {
    if (lapNum === null) return;

    if (prevLapNumRef.current !== null && lapNum < prevLapNumRef.current) {
      setHistory([]);

      prevLapNumRef.current = lapNum;

      return;
    }

    if (
      lastLapTime !== null &&
      lastLapTime > 0 &&
      prevLapNumRef.current !== null &&
      lapNum > prevLapNumRef.current
    ) {
      const rawDelta = getGameDelta(lapTimingRef.current, referenceRef.current);

      const entry: HistoryEntry = {
        lapNum: prevLapNumRef.current,
        lapTime: lastLapTime,
        delta: rawDelta !== 0 ? rawDelta : null,
      };

      setHistory((prev) => [entry, ...prev].slice(0, HISTORY_STORE_SIZE));
    }

    prevLapNumRef.current = lapNum;
  }, [lapNum, lastLapTime]);

  const currentLapTime = lapTiming?.lap_current_lap_time ?? 0;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  const liveDelta = getGameDelta(lapTiming, reference);

  const visibleHistory = history.slice(0, HISTORY_SHOW_SIZE);

  const bestIdx = visibleHistory.reduce<number>((best, entry, idx) => {
    if (best === -1) return idx;

    return entry.lapTime < visibleHistory[best].lapTime ? idx : best;
  }, -1);

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

      {visibleHistory.map((entry, idx) => {
        const isThisBest = idx === bestIdx;

        return (
          <LapRow
            key={entry.lapNum}
            lapLabel={`L${entry.lapNum}`}
            time={formatLapTime(entry.lapTime)}
            deltaLabel={isThisBest ? '★ BEST' : formatDelta(entry.delta)}
            deltaColor={
              isThisBest
                ? 'rgba(192, 132, 252, 0.85)' // TODO: use style class and variables
                : entry.delta !== null
                  ? DELTA_COLORS[getDeltaState(entry.delta)]
                  : undefined
            }
            isBest={isThisBest}
          />
        );
      })}
    </WidgetPanel>
  );
});

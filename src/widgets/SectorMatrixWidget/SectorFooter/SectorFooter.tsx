import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
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
import type {
  LapDeltaReference,
  SectorMatrixWidgetSettings,
} from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './SectorFooter.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const SectorFooter = observer(() => {
  const { lapTiming } = useTelemetryStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference } =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const lastLap = lapTiming?.lap_last_lap_time ?? null;

  const lapTimingRef = useRef(lapTiming);
  lapTimingRef.current = lapTiming;

  const referenceRef = useRef(reference);
  referenceRef.current = reference;

  const [lastLapDelta, setLastLapDelta] = useState<number | null>(null);
  const [lastLapReference, setLastLapReference] =
    useState<LapDeltaReference>(reference);
  const prevLastLapRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastLap === null || lastLap <= 0) return;
    if (prevLastLapRef.current === lastLap) return;

    prevLastLapRef.current = lastLap;

    const rawDelta = getGameDelta(lapTimingRef.current, referenceRef.current);
    setLastLapDelta(rawDelta !== 0 ? rawDelta : null);
    setLastLapReference(referenceRef.current);
  }, [lastLap]);

  const bestLap = lapTiming?.lap_best_lap_time ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.entry}>
        <span className={styles.tag}>LAST</span>

        <span className={styles.time}>{formatLapTime(lastLap)}</span>

        {lastLapDelta !== null && (
          <>
            <span
              className={`${styles.delta} ${DELTA_CLASS[getDeltaState(lastLapDelta)]}`}
            >
              {formatDelta(lastLapDelta)}
            </span>

            <ReferenceBadge reference={lastLapReference} />
          </>
        )}
      </div>

      <div className={styles.entry}>
        <span className={styles.tag}>BEST</span>

        <span className={`${styles.time} ${styles.bestTime}`}>
          {formatLapTime(bestLap)}
        </span>
      </div>
    </div>
  );
});

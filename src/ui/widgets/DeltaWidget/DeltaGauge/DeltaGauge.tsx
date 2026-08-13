import { useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  DELTA_GAUGE_RANGES,
  getDeltaState,
  resolveGaugeRange,
} from '@utils/delta-utils';
import styles from './DeltaGauge.module.scss';

interface Props {
  delta: number | null;
  /**
   * Fixed seconds per half of the track. Omit to let the gauge auto-range
   * through DELTA_GAUGE_RANGES the way the sim's own delta bar does.
   */
  range?: number;
}

const HALF_TRACK_PCT = 50;

const FILL_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaGauge = observer(({ delta, range }: Props) => {
  const autoRangeRef = useRef<number>(DELTA_GAUGE_RANGES[0]);

  if (range === undefined) {
    autoRangeRef.current = resolveGaugeRange(delta, autoRangeRef.current);
  }

  const activeRange = range ?? autoRangeRef.current;
  const clamped = Math.max(-activeRange, Math.min(activeRange, delta ?? 0));
  const widthPct = (Math.abs(clamped) / activeRange) * HALF_TRACK_PCT;
  const leftPct = clamped >= 0 ? HALF_TRACK_PCT : HALF_TRACK_PCT - widthPct;

  return (
    <div className={styles.track}>
      <div
        className={`${styles.fill} ${FILL_CLASS[getDeltaState(delta)]}`}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
      <div className={styles.zero} />
    </div>
  );
});

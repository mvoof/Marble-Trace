import { observer } from 'mobx-react-lite';
import { getDeltaState } from '@utils/widget/delta-utils';
import styles from './DeltaGauge.module.scss';

interface Props {
  delta: number | null;
  /** Seconds mapped to each half of the track; beyond this the fill pins. */
  range?: number;
}

const DEFAULT_RANGE_SECONDS = 1;
const HALF_TRACK_PCT = 50;

const FILL_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaGauge = observer(
  ({ delta, range = DEFAULT_RANGE_SECONDS }: Props) => {
    const clamped = Math.max(-range, Math.min(range, delta ?? 0));
    const widthPct = (Math.abs(clamped) / range) * HALF_TRACK_PCT;
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
  }
);

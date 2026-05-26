import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { formatDelta, getDeltaState } from '@utils/widget/delta-utils';
import styles from './LapFlash.module.scss';

interface Props {
  lapNum: number;
  lapTime: number;
  delta: number;
  isBest: boolean;
  duration?: number;
}

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const LapFlash = observer(
  ({ lapTime, delta, isBest, duration = 5 }: Props) => {
    const state = getDeltaState(delta);

    return (
      <div className={styles.root}>
        <div
          className={`${styles.flashBar} ${DELTA_CLASS[state]}`}
          style={{ animationDuration: `${duration}s` }}
        />

        {isBest && <span className={styles.best}>★ NEW BEST</span>}

        <div className={styles.times}>
          <span className={styles.lapTime}>{formatLapTime(lapTime)}</span>
          <span className={`${styles.lapDelta} ${DELTA_CLASS[state]}`}>
            {formatDelta(delta)}
          </span>
        </div>
      </div>
    );
  }
);

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
  preview?: boolean;
}

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const LapFlash = observer(
  ({ lapTime, delta, isBest, duration = 5, preview = false }: Props) => {
    const state = getDeltaState(delta);

    const deltaEl = (
      <span className={`${styles.lapDelta} ${DELTA_CLASS[state]}`}>
        {formatDelta(delta)}
      </span>
    );

    const animationStyle = preview
      ? { animationName: 'none' }
      : { animationDuration: `${duration}s` };

    return (
      <div className={styles.root} style={animationStyle}>
        <div
          className={`${styles.flashBar} ${DELTA_CLASS[state]}`}
          style={animationStyle}
        />

        {isBest && <span className={styles.best}>★ NEW BEST</span>}

        <div className={styles.times}>
          <span className={styles.lapTime}>{formatLapTime(lapTime)}</span>
          {deltaEl}
        </div>
      </div>
    );
  }
);

import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import styles from './LapFlash.module.scss';

interface Props {
  lapNum: number;
  lapTime: number;
  isBest: boolean;
  duration?: number;
  preview?: boolean;
}

const BEST_CLASS = styles.ahead;

export const LapFlash = observer(
  ({ lapTime, isBest, duration = 5, preview = false }: Props) => {
    const animationStyle = preview
      ? { animationName: 'none' }
      : { animationDuration: `${duration}s` };

    return (
      <div className={styles.root} style={animationStyle}>
        <div
          className={`${styles.flashBar} ${isBest ? BEST_CLASS : styles.neutral}`}
          style={animationStyle}
        />

        {isBest && <span className={styles.best}>★ NEW BEST</span>}

        <div className={styles.times}>
          <span className={styles.lapTime}>{formatLapTime(lapTime)}</span>
        </div>
      </div>
    );
  }
);

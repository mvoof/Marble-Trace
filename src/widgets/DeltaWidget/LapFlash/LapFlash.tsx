import { observer } from 'mobx-react-lite';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import { formatDelta, getDeltaState } from '@utils/widget/delta-utils';
import styles from './LapFlash.module.scss';

interface Props {
  lapTime: number;
  /** Personal best at the time the lap was recorded — colors the lap time. */
  isBest: boolean;
  /**
   * Gap to the driver's own best lap before this one. For a new personal best
   * this is how much the old mark was beaten by, not a meaningless zero.
   */
  personalDelta?: number | null;
  duration?: number;
  preview?: boolean;
}

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

const RING_RADIUS = 9;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const LapFlash = observer(
  ({
    lapTime,
    isBest,
    personalDelta = null,
    duration = 5,
    preview = false,
  }: Props) => {
    const animationStyle = preview
      ? { animationName: 'none' }
      : { animationDuration: `${duration}s` };

    return (
      <div className={styles.root} style={animationStyle}>
        <svg
          className={styles.ring}
          viewBox="0 0 22 22"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            className={styles.ringTrack}
            cx="11"
            cy="11"
            r={RING_RADIUS}
          />
          <circle
            className={`${styles.ringProgress} ${isBest ? styles.ringBest : ''}`}
            cx="11"
            cy="11"
            r={RING_RADIUS}
            strokeDasharray={RING_CIRCUMFERENCE}
            style={animationStyle}
          />
        </svg>

        <div className={`${styles.lapTime} ${isBest ? styles.best : ''}`}>
          {formatLapTime(lapTime)}
        </div>

        <div
          className={`${styles.delta} ${DELTA_CLASS[getDeltaState(personalDelta)]}`}
        >
          {formatDelta(personalDelta)}
        </div>
      </div>
    );
  }
);

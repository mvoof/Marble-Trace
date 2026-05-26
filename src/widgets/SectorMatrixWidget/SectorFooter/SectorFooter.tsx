import { observer } from 'mobx-react-lite';
import { useTelemetryStore } from '@store/root-store-context';
import { formatLapTime } from '@utils/formatters/telemetry-format';
import styles from './SectorFooter.module.scss';

export const SectorFooter = observer(() => {
  const { lapTiming } = useTelemetryStore();

  const lastLapTime = lapTiming?.lap_last_lap_time ?? null;
  const bestLapTime = lapTiming?.lap_best_lap_time ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.entry}>
        <span className={styles.tag}>LAST</span>

        <span className={styles.time}>{formatLapTime(lastLapTime)}</span>
      </div>

      <div className={styles.entry}>
        <span className={styles.tag}>BEST</span>

        <span className={`${styles.time} ${styles.bestTime}`}>
          {formatLapTime(bestLapTime)}
        </span>
      </div>
    </div>
  );
});

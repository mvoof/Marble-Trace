import { observer } from 'mobx-react-lite';

import styles from './PitSpeedPlate.module.scss';
import { speedFillPct } from '@widgets/PitServiceWidget/pit-service-utils';
import { parsePitSpeedLimitMs } from '@utils/telemetry-format';
import { speedUnit } from '@utils/telemetry-format';
import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

const HALF = 0.5;
const PCT = 100;

export const PitSpeedPlate = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();

  const speedMs = player.carDynamics?.speed ?? 0;
  const limitMs = parsePitSpeedLimitMs(sessionInfo?.trackPitSpeedLimit);

  const factor = units.speedFactor;
  const fill = speedFillPct(speedMs, limitMs);
  const isOver = limitMs > 0 && speedMs > limitMs;

  const greenWidth = Math.min(fill, HALF) * PCT;
  const redWidth = Math.max(fill - HALF, 0) * PCT;

  return (
    <div className={styles.plate}>
      <span className={styles.fill} style={{ width: `${greenWidth}%` }} />

      {redWidth > 0 && (
        <span
          className={styles.fillOver}
          style={{ left: `${HALF * PCT}%`, width: `${redWidth}%` }}
        />
      )}

      <div className={`${styles.cell} ${styles.cellNow}`}>
        <span className={styles.key}>SPEED</span>

        <span className={`${styles.value} ${isOver ? styles.valueOver : ''}`}>
          {Math.round(speedMs * factor)}
        </span>

        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      </div>

      <div className={styles.cell}>
        <span className={styles.key}>PIT LIMIT</span>

        <span className={styles.valueLimit}>
          {limitMs > 0 ? Math.round(limitMs * factor) : '—'}
        </span>

        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      </div>
    </div>
  );
});

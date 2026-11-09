import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import type { FuelLapsStatus } from '../fuel-utils';
import { useFuelLapsStatus } from '../use-fuel-status';

import styles from './FuelProgress.module.scss';

const FILL_STATUS_CLASSES: Record<FuelLapsStatus, string> = {
  safe: '',
  warning: styles.trackWarning,
  danger: styles.trackDanger,
};

/** The quarters of the tank the track is ruled into. */
const TANK_QUARTERS = 4;

export const FuelProgress = observer(() => {
  const { carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const lapsStatus = useFuelLapsStatus();

  const fuelLevel = carStatus?.fuel_level ?? null;
  const fuelMax = sessionInfo?.fuelCapacityLtr ?? null;

  const pct =
    fuelLevel !== null && fuelMax !== null && fuelMax > 0
      ? Math.min(fuelLevel / fuelMax, 1)
      : null;

  const statusClass =
    lapsStatus !== null ? FILL_STATUS_CLASSES[lapsStatus] : '';

  return (
    <div className={styles.progressSection}>
      <div className={`${styles.track} ${statusClass}`}>
        {pct !== null && (
          <div
            className={styles.fill}
            style={{ '--progress': pct } as CSSProperties}
          />
        )}

        <div className={styles.quarters}>
          {[...Array(TANK_QUARTERS).keys()].map((quarterIndex) => (
            <span className={styles.quarter} key={quarterIndex} />
          ))}
        </div>
      </div>
    </div>
  );
});

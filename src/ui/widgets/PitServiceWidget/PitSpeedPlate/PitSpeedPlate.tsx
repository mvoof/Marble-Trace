import { observer } from 'mobx-react-lite';

import styles from './PitSpeedPlate.module.scss';
import {
  speedFillPct,
  SWEET_SPOT_SHARE,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import { parsePitSpeedLimitMs } from '@utils/telemetry-format';
import { speedUnit } from '@utils/telemetry-format';
import {
  usePitServiceWidgetStore,
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
  const pitService = usePitServiceWidgetStore();

  const speedMs = player.carDynamics?.speed ?? 0;
  const limitMs = parsePitSpeedLimitMs(sessionInfo?.trackPitSpeedLimit);

  const factor = units.speedFactor;
  const fill = speedFillPct(speedMs, limitMs);

  // Past the pit exit the limit no longer applies: the plate turns fully green
  // and the limit cell becomes the go-ahead, so the driver reads "clear" from
  // the block that was policing them a second ago.
  const isReleased = !pitService.isOnPitRoad;
  const isOver = !isReleased && limitMs > 0 && speedMs > limitMs;

  const greenWidth = isReleased ? PCT : Math.min(fill, HALF) * PCT;
  const redWidth = isReleased ? 0 : Math.max(fill - HALF, 0) * PCT;

  const sweetSpotLeft = SWEET_SPOT_SHARE * HALF * PCT;
  const sweetSpotWidth = (1 - SWEET_SPOT_SHARE) * HALF * PCT;
  const isInSweetSpot =
    !isReleased && !isOver && fill >= SWEET_SPOT_SHARE * HALF;

  return (
    <div className={styles.plate}>
      {/*
        The two tracks and the band are painted whether or not the car is moving:
        the point of the plate is that the driver can see how much throttle is
        left before the limit without first having to approach it.
      */}
      {!isReleased && (
        <>
          <span className={styles.trackAllowed} />
          <span className={styles.trackPenalty} />

          <span
            className={`${styles.sweetSpot} ${isInSweetSpot ? styles.sweetSpotActive : ''}`}
            style={{ left: `${sweetSpotLeft}%`, width: `${sweetSpotWidth}%` }}
          />
        </>
      )}

      <span
        className={`${styles.fill} ${isReleased ? styles.fillReleased : ''}`}
        style={{ width: `${greenWidth}%` }}
      />

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

      {isReleased ? (
        <div className={styles.cell}>
          <span className={styles.key}>PIT EXIT</span>

          <span className={styles.valueGo}>GO!</span>

          <span className={styles.unit}>NO LIMIT</span>
        </div>
      ) : (
        <div className={styles.cell}>
          <span className={styles.key}>PIT LIMIT</span>

          <span className={styles.valueLimit}>
            {limitMs > 0 ? Math.round(limitMs * factor) : '—'}
          </span>

          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </div>
      )}
    </div>
  );
});

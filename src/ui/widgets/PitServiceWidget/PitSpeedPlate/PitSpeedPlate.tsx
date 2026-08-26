import { observer } from 'mobx-react-lite';

import styles from './PitSpeedPlate.module.scss';
import {
  buildSpeedRow,
  formatSpeedMargin,
  SPEED_GREEN_SHARE,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import { parsePitSpeedLimitMs, speedUnit } from '@utils/telemetry-format';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

const PCT = 100;

/**
 * One row, three states. With the limiter engaged the sim holds the speed, so
 * the row stops being a gauge and simply names both numbers. Without it the row
 * is a scale whose readout is the margin left before the limit rather than the
 * speed itself — "how much more can I give it" is the question being asked, and
 * a raw speed answers it only after the driver does the subtraction.
 */
export const PitSpeedPlate = observer(() => {
  const player = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();
  const pitService = usePitServiceWidgetStore();

  const speedMs = player.carDynamics?.speed ?? 0;
  const limitMs = parsePitSpeedLimitMs(sessionInfo?.trackPitSpeedLimit);
  const factor = units.speedFactor;
  const unit = speedUnit(units.unitSystem);

  // Both states are the store's to decide: the limiter bit and what counts as
  // being out of the pits are read by the auto-service reactions too, and two
  // answers to "are we still bound by the limit" is one too many.
  if (pitService.isPitLimitReleased) {
    return (
      <div className={`${styles.row} ${styles.rowReleased}`}>
        <span className={styles.label}>PIT EXIT</span>

        <span className={styles.value}>GO!</span>
      </div>
    );
  }

  if (pitService.isLimiterOn) {
    return (
      <div className={`${styles.row} ${styles.rowLimiter}`}>
        <span className={styles.label}>PIT LIMITER</span>

        <span className={`${styles.value} ${styles.valueWide}`}>
          {Math.round(speedMs * factor)}/
          {limitMs > 0 ? Math.round(limitMs * factor) : '—'}
        </span>

        <span className={styles.unit}>{unit}</span>
      </div>
    );
  }

  const view = buildSpeedRow(
    speedMs,
    limitMs,
    player.carDynamics?.long_accel ?? null,
    factor
  );

  return (
    <div className={styles.row}>
      <span className={styles.trackAllowed} />

      <span className={styles.trackPenalty} />

      <span className={styles.fill} style={{ width: `${view.fill * PCT}%` }} />

      {view.overFill > 0 && (
        <span
          className={styles.fillOver}
          style={{
            left: `${SPEED_GREEN_SHARE * PCT}%`,
            width: `${view.overFill * PCT}%`,
          }}
        />
      )}

      {/*
        Where the car coasts to at the current throttle. Once the fill reaches
        into this band the limit is already spoken for — lifting here is what
        keeps the stop legal, which no static "sweet spot" could say.
      */}
      {view.liftStart !== null && view.liftWidth !== null && (
        <span
          className={styles.liftZone}
          style={{
            left: `${view.liftStart * PCT}%`,
            width: `${view.liftWidth * PCT}%`,
          }}
        />
      )}

      <span className={styles.limitTick} />

      <span className={styles.label}>PIT SPEED</span>

      <span
        className={`${styles.value} ${view.isOver ? styles.valueOver : styles.valueUnder}`}
      >
        {limitMs > 0 ? formatSpeedMargin(view.margin) : '—'}
      </span>

      <span className={styles.unit}>{unit}</span>
    </div>
  );
});

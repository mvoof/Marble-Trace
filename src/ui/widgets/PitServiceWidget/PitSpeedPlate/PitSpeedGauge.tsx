import { observer } from 'mobx-react-lite';

import {
  buildSpeedRow,
  formatSpeedMargin,
  SPEED_GREEN_SHARE,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import { parsePitSpeedLimitMs, speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import styles from './PitSpeedPlate.module.scss';

const PCT = 100;

const NO_LIMIT_TEXT = '—';

const FILL_WIDTH_PROPERTY = '--speed-fill';
const OVER_LEFT_PROPERTY = '--speed-over-left';
const OVER_WIDTH_PROPERTY = '--speed-over-width';
const LIFT_LEFT_PROPERTY = '--speed-lift-left';
const LIFT_WIDTH_PROPERTY = '--speed-lift-width';

/**
 * The gauge state, without the limiter: a scale whose readout is the margin left
 * before the limit rather than the speed itself. Speed changes on every physics
 * tick, so the bars and the number are written straight to the DOM and React
 * renders the row once. See `docs/rendering.md`.
 */
export const PitSpeedGauge = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const units = useUnitsStore();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const speedMs = player.carDynamics?.speed ?? 0;
      const limitMs = parsePitSpeedLimitMs(
        sessionStore.sessionInfo?.trackPitSpeedLimit
      );

      const view = buildSpeedRow(
        speedMs,
        limitMs,
        player.carDynamics?.long_accel ?? null,
        units.speedFactor
      );

      const marginText =
        limitMs > 0 ? formatSpeedMargin(view.margin) : NO_LIMIT_TEXT;

      scheduleWrite(() => {
        element.style.setProperty(FILL_WIDTH_PROPERTY, `${view.fill * PCT}%`);
        element.style.setProperty(
          OVER_LEFT_PROPERTY,
          `${SPEED_GREEN_SHARE * PCT}%`
        );
        element.style.setProperty(
          OVER_WIDTH_PROPERTY,
          `${view.overFill * PCT}%`
        );

        const over = element.querySelector(`.${styles.fillOver}`);

        if (over instanceof HTMLElement) {
          over.hidden = view.overFill <= 0;
        }

        const lift = element.querySelector(`.${styles.liftZone}`);
        const hasLift = view.liftStart !== null && view.liftWidth !== null;

        if (lift instanceof HTMLElement) {
          lift.hidden = !hasLift;
        }

        if (hasLift) {
          element.style.setProperty(
            LIFT_LEFT_PROPERTY,
            `${(view.liftStart ?? 0) * PCT}%`
          );
          element.style.setProperty(
            LIFT_WIDTH_PROPERTY,
            `${(view.liftWidth ?? 0) * PCT}%`
          );
        }

        const value = element.querySelector(`.${styles.value}`);

        if (value instanceof HTMLElement) {
          value.classList.toggle(styles.valueOver, view.isOver);
          value.classList.toggle(styles.valueUnder, !view.isOver);
          value.textContent = marginText;
        }
      });
    },
    [player, sessionStore, units]
  );

  return (
    <div ref={rowRef} className={styles.row}>
      <span className={styles.trackAllowed} />

      <span className={styles.trackPenalty} />

      <span className={styles.fill} />

      <span className={styles.fillOver} />

      {/*
        Where the car coasts to at the current throttle. Once the fill reaches
        into this band the limit is already spoken for, and lifting here is what
        keeps the stop legal, which no static "sweet spot" could say.
      */}
      <span className={styles.liftZone} />

      <span className={styles.limitTick} />

      <span className={styles.label}>PIT SPEED</span>

      {/*
        Parked against the limit seam rather than against the row's own edge:
        the number the driver reads and the line it is being read against sit
        together, and the overspeed band past the seam stays clear of text.
      */}
      <span className={styles.readout}>
        <span className={styles.value} />

        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      </span>
    </div>
  );
});

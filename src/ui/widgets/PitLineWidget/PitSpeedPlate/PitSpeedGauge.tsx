import { observer } from 'mobx-react-lite';

import {
  buildSpeedRow,
  SPEED_GREEN_SHARE,
} from '@ui/widgets/PitLineWidget/pit-line-utils';
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
 * The gauge state, without the limiter: the speed itself, written against the
 * limit line rather than beside it. The number rides under the line while the
 * speed is legal and jumps over it the moment it is not, so the offence is a
 * change of position as well as of colour — read from the corner of an eye that
 * is on the lane, not on the widget.
 *
 * Speed changes on every physics tick, so the bars and the number are written
 * straight to the DOM and React renders the row once. See `docs/rendering.md`.
 */
interface PitSpeedGaugeProps {
  withUnit: boolean;
}

export const PitSpeedGauge = observer(({ withUnit }: PitSpeedGaugeProps) => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const units = useUnitsStore();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const speedMs = player.carDynamics?.speed ?? 0;
      const limitMs = parsePitSpeedLimitMs(
        sessionStore.sessionInfo?.trackPitSpeedLimit
      );

      const view = buildSpeedRow(
        speedMs,
        limitMs,
        // oxlint-disable-next-line no-restricted-properties
        player.carDynamics?.long_accel ?? null
      );

      const speedText =
        limitMs > 0
          ? Math.round(speedMs * units.speedFactor).toString()
          : NO_LIMIT_TEXT;

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
          value.textContent = speedText;
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

      {/*
        A zero-height anchor on the limit line itself: the number hangs below it
        under the limit and sits above it once over, so the two states are the
        two sides of the same line rather than two colours of the same text.
      */}
      <span className={styles.seam}>
        <span className={styles.value} />
      </span>

      {/* Read once, so it keeps out of the way at the foot of the column. */}
      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});

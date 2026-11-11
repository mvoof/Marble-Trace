import { observer } from 'mobx-react-lite';

import {
  buildSpeedRow,
  SPEED_GREEN_SHARE,
} from '@widgets/pit-line/pit-line-utils';
import { parsePitSpeedLimitMs, speedUnit } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useLiveParts, writeStyle } from '@shared/ui/live/live-parts';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';

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

  const parts = useLiveParts<'over' | 'lift' | 'value'>();

  const rowRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const speedMs = player.carDynamics?.speed ?? 0;
      const limitMs = parsePitSpeedLimitMs(
        sessionStore.sessionInfo?.trackPitSpeedLimit
      );

      const view = buildSpeedRow(
        speedMs,
        limitMs,
        player.carDynamics?.long_accel ?? null
      );

      const speedText =
        limitMs > 0
          ? Math.round(speedMs * units.speedFactor).toString()
          : NO_LIMIT_TEXT;

      scheduleWrite(() => {
        writeStyle(element, FILL_WIDTH_PROPERTY, `${view.fill * PCT}%`);
        writeStyle(element, OVER_LEFT_PROPERTY, `${SPEED_GREEN_SHARE * PCT}%`);
        writeStyle(element, OVER_WIDTH_PROPERTY, `${view.overFill * PCT}%`);

        parts.attribute('over', 'hidden', view.overFill <= 0 ? '' : null);

        const hasLift = view.liftStart !== null && view.liftWidth !== null;

        parts.attribute('lift', 'hidden', hasLift ? null : '');

        if (hasLift) {
          writeStyle(
            element,
            LIFT_LEFT_PROPERTY,
            `${(view.liftStart ?? 0) * PCT}%`
          );
          writeStyle(
            element,
            LIFT_WIDTH_PROPERTY,
            `${(view.liftWidth ?? 0) * PCT}%`
          );
        }

        parts.state('value', 'limit', view.isOver ? 'over' : 'under');
        parts.text('value', speedText);
      });
    },
    [player, sessionStore, units, parts]
  );

  return (
    <div ref={rowRef} className={styles.row}>
      <span className={styles.trackAllowed} />

      <span className={styles.trackPenalty} />

      <span className={styles.fill} />

      <span ref={parts.ref('over')} className={styles.fillOver} />

      {/*
        Where the car coasts to at the current throttle. Once the fill reaches
        into this band the limit is already spoken for, and lifting here is what
        keeps the stop legal, which no static "sweet spot" could say.
      */}
      <span ref={parts.ref('lift')} className={styles.liftZone} />

      <span className={styles.limitTick} />

      {/*
        A zero-height anchor on the limit line itself: the number hangs below it
        under the limit and sits above it once over, so the two states are the
        two sides of the same line rather than two colours of the same text.
      */}
      <span className={styles.seam}>
        <span ref={parts.ref('value')} className={styles.value} />
      </span>

      {/* Read once, so it keeps out of the way at the foot of the column. */}
      {withUnit && (
        <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
      )}
    </div>
  );
});

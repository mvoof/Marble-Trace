import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';
import { computeShiftThresholds } from '@utils/car-signals';
import { computeRpmZoneState, rpmFillColor } from '../race-dash-utils';
import {
  ARC_SWEEP_DEG,
  RING_SIZE,
  ringTickSegment,
} from '../RingBadge/ring-geometry';

import styles from './RpmComb.module.scss';

// Coarse enough that each tick is a distinct step the eye can count, fine
// enough that the last few before the shift point still resolve individually:
// 30 ticks over the 300° sweep is one every 10°.
const TICK_COUNT = 30;

// Geometry only — it depends on TICK_COUNT and the ring's own constants, never
// on telemetry, so it is computed once at import rather than on every render.
const TICK_SEGMENTS = Array.from({ length: TICK_COUNT }, (_unused, index) =>
  ringTickSegment((index + 0.5) * (ARC_SWEEP_DEG / TICK_COUNT))
);

/**
 * The RPM scale as a comb of fixed ticks instead of a continuous arc: ticks
 * light up one by one as revs climb, so the approach to the shift point reads
 * as discrete clicks rather than a bar creeping forward. Unlit ticks keep the
 * printed shift and redline bands of the fill arc, so the zone boundaries are
 * visible before the driver reaches them.
 *
 * The ticks are markup React writes once; the revs reach them through the
 * reactive-DOM primitive, one pass over the row per animation frame. See
 * `docs/rendering.md`.
 */
export const RpmComb = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const rootRef = useReactiveDomWrite<SVGSVGElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const gear = player.carDynamics?.gear ?? 0;
      // oxlint-disable-next-line no-restricted-properties
      const rpm = player.carDynamics?.rpm ?? 0;

      const { pct, zone } = computeRpmZoneState(
        rpm,
        sessionStore.sessionInfo,
        player.carStatus,
        gear
      );
      const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
        sessionStore.sessionInfo,
        player.carStatus,
        gear
      );

      const shiftPct = Math.min(Math.max(shiftRpm / (redLine || 1), 0), 1);
      const blinkPct = Math.max(
        Math.min(Math.max(blinkRpm / (redLine || 1), 0), 1),
        shiftPct
      );

      const litColor = rpmFillColor(zone, settings);
      const litCount = Math.round(pct * TICK_COUNT);

      scheduleWrite(() => {
        for (let index = 0; index < TICK_COUNT; index += 1) {
          const tick = element.children[index];

          if (!(tick instanceof SVGLineElement)) {
            continue;
          }

          // Each tick stands for the band it opens, so its own fraction is
          // its leading edge — the tick at the shift threshold is the first
          // amber one.
          const tickPct = (index + 1) / TICK_COUNT;
          const isLit = index < litCount;

          if (isLit) {
            tick.setAttribute('class', styles.lit);
            tick.style.stroke = litColor ?? '';
            continue;
          }

          tick.style.stroke = '';

          if (tickPct > blinkPct) {
            tick.setAttribute('class', styles.idleRedline);
          } else if (tickPct > shiftPct) {
            tick.setAttribute('class', styles.idleShift);
          } else {
            tick.setAttribute('class', styles.idle);
          }
        }
      });
    },
    [player, sessionStore, settings]
  );

  return (
    <svg
      ref={rootRef}
      className={styles.root}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      {TICK_SEGMENTS.map((segment, index) => (
        <line
          key={index}
          className={styles.idle}
          x1={segment.x1.toFixed(3)}
          y1={segment.y1.toFixed(3)}
          x2={segment.x2.toFixed(3)}
          y2={segment.y2.toFixed(3)}
        />
      ))}
    </svg>
  );
});

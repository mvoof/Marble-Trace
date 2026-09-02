import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
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

/**
 * The RPM scale as a comb of fixed ticks instead of a continuous arc: ticks
 * light up one by one as revs climb, so the approach to the shift point reads
 * as discrete clicks rather than a bar creeping forward. Unlit ticks keep the
 * printed shift and redline bands of the fill arc, so the zone boundaries are
 * visible before the driver reaches them.
 */
export const RpmComb = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const gear = carDynamics?.gear ?? 0;
  const rpm = carDynamics?.rpm ?? 0;

  const { pct, zone } = computeRpmZoneState(rpm, sessionInfo, carStatus, gear);
  const { shiftRpm, blinkRpm, redLine } = computeShiftThresholds(
    sessionInfo,
    carStatus,
    gear
  );

  const shiftPct = Math.min(Math.max(shiftRpm / (redLine || 1), 0), 1);
  const blinkPct = Math.max(
    Math.min(Math.max(blinkRpm / (redLine || 1), 0), 1),
    shiftPct
  );

  const litColor = rpmFillColor(zone, settings);
  const litCount = Math.round(pct * TICK_COUNT);

  const ticks = Array.from({ length: TICK_COUNT }, (_unused, index) => {
    // Each tick stands for the band it opens, so its own fraction is its
    // leading edge — the tick at the shift threshold is the first amber one.
    const tickPct = (index + 1) / TICK_COUNT;
    const segment = ringTickSegment(
      (index + 0.5) * (ARC_SWEEP_DEG / TICK_COUNT)
    );
    const isLit = index < litCount;

    if (isLit) {
      return { index, segment, className: styles.lit, color: litColor };
    }

    if (tickPct > blinkPct) {
      return { index, segment, className: styles.idleRedline, color: null };
    }

    if (tickPct > shiftPct) {
      return { index, segment, className: styles.idleShift, color: null };
    }

    return { index, segment, className: styles.idle, color: null };
  });

  return (
    <svg
      className={styles.root}
      viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
      aria-hidden="true"
    >
      {ticks.map(({ index, segment, className, color }) => (
        <line
          key={index}
          className={className}
          x1={segment.x1.toFixed(3)}
          y1={segment.y1.toFixed(3)}
          x2={segment.x2.toFixed(3)}
          y2={segment.y2.toFixed(3)}
          style={color ? { stroke: color } : undefined}
        />
      ))}
    </svg>
  );
});

import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import type { BattleSlot } from '../wheel-to-wheel.widget';
import { SPEED_SEGMENT_COUNT } from '../wheel-to-wheel-utils';

import styles from './SpeedBar.module.scss';

interface SpeedBarProps {
  slot: BattleSlot;
  compact?: boolean;
}

const SEGMENTS = Array.from(
  { length: SPEED_SEGMENT_COUNT },
  (_unused, index) => index
);

/** Who carries more speed: the faster car's bar is the longer one. */
export const SpeedBar = observer(({ slot, compact }: SpeedBarProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const lit = wheelToWheel.slots[slot].litSegments;

  return (
    <div className={`${styles.bar} ${compact ? styles.barCompact : ''}`}>
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          className={`${styles.segment} ${lit !== null && segment < lit ? styles.segmentLit : ''}`}
        />
      ))}
    </div>
  );
});

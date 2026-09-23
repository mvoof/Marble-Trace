import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import type { BattleSlot } from '../wheel-to-wheel.widget';

import styles from './PositionBox.module.scss';

interface PositionBoxProps {
  slot: BattleSlot;
  compact?: boolean;
}

const NO_POSITION = '—';

/** The class position, framed in the slot's accent. */
export const PositionBox = observer(({ slot, compact }: PositionBoxProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const identity = wheelToWheel.slots[slot].identity;

  return (
    <div className={`${styles.box} ${compact ? styles.boxCompact : ''}`}>
      <span className={styles.position}>
        {identity?.position || NO_POSITION}
      </span>
    </div>
  );
});

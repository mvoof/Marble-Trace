import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import type { BattleSlot } from '../wheel-to-wheel.widget';

import styles from './CarNumberBox.module.scss';

interface CarNumberBoxProps {
  slot: BattleSlot;
  compact?: boolean;
}

const NO_NUMBER = '—';

/** The car number, framed in the slot's accent — what the driver sees on the bodywork. */
export const CarNumberBox = observer(({ slot, compact }: CarNumberBoxProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const identity = wheelToWheel.slots[slot].identity;

  return (
    <div className={`${styles.box} ${compact ? styles.boxCompact : ''}`}>
      <span className={styles.number}>{identity?.carNumber || NO_NUMBER}</span>
    </div>
  );
});

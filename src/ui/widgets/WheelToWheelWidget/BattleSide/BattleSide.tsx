import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import type { BattleSlot } from '../wheel-to-wheel.widget';
import { SideSpeed } from '../SideSpeed/SideSpeed';
import { SpeedBar } from '../SpeedBar/SpeedBar';
import { CarNumberBox } from '../CarNumberBox/CarNumberBox';
import { SLOT_ROLE, formatSlotPosition } from '../slot-labels';

import styles from './BattleSide.module.scss';

interface BattleSideProps {
  slot: BattleSlot;
}

/** Placeholder a side prints before the relative frame names its car. */
const NO_DRIVER = '—';

/**
 * One car of the fight, at full height. Only its identity is read here — it
 * changes when the rival does, not on every tick — and the moving numbers are
 * left to the two leaves below, so a 10 Hz frame re-renders a readout and a
 * bar, not the side.
 */
export const BattleSide = observer(({ slot }: BattleSideProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const identity = wheelToWheel.slots[slot].identity;
  const isPlayer = slot === 'player';

  return (
    <div
      className={`${styles.side} ${isPlayer ? styles.sidePlayer : styles.sideRival}`}
    >
      <div className={styles.header}>
        <CarNumberBox slot={slot} />

        <div className={styles.names}>
          <span className={styles.role}>
            {SLOT_ROLE[slot]}
            <span className={styles.position}>
              {formatSlotPosition(identity?.position)}
            </span>
          </span>
          <span className={styles.name}>{identity?.name ?? NO_DRIVER}</span>
          <span className={styles.carName}>{identity?.carName ?? ''}</span>
        </div>
      </div>

      <SideSpeed slot={slot} />
      <SpeedBar slot={slot} />
    </div>
  );
});

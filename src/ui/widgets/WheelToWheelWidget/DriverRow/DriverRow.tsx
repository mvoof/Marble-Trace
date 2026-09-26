import { observer } from 'mobx-react-lite';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/shared/FixedDigits/FixedDigits';
import type { BattleSlot, RivalSlot } from '../wheel-to-wheel.widget';
import { CarNumberBox } from '../CarNumberBox/CarNumberBox';
import { SideSpeed } from '../SideSpeed/SideSpeed';
import { SpeedBar } from '../SpeedBar/SpeedBar';
import { SLOT_ROLE, formatSlotPosition } from '../slot-labels';

import styles from './DriverRow.module.scss';

interface DriverRowProps {
  slot: BattleSlot;
}

const NO_DRIVER = '—';
const GAP_CAPTION = 'Gap';

/**
 * One driver of the rows layout: who, how fast, and — for a rival — how far.
 * The player's row keeps an empty gap cell so every column lines up.
 */
export const DriverRow = observer(({ slot }: DriverRowProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const identity = wheelToWheel.slots[slot].identity;
  const isPlayer = slot === 'player';

  return (
    <div
      className={`${styles.row} ${isPlayer ? styles.rowPlayer : styles.rowRival}`}
    >
      <div className={styles.who}>
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

      <div className={styles.divider} />

      <div className={styles.pace}>
        <SideSpeed slot={slot} />
        <SpeedBar slot={slot} />
      </div>

      <div className={styles.divider} />

      <div className={styles.gapCell}>
        {!isPlayer && <RowGap slot={slot} />}
      </div>
    </div>
  );
});

interface RowGapProps {
  slot: RivalSlot;
}

const GAP_ARROW: Record<RivalSlot, typeof ArrowUp> = {
  ahead: ArrowUp,
  behind: ArrowDown,
};

/** The only part of a row that moves with the gap, so the only part that re-renders. */
const RowGap = observer(({ slot }: RowGapProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();
  const Arrow = GAP_ARROW[slot];

  return (
    <div className={styles.gap}>
      <Arrow className={styles.gapArrow} strokeWidth={3} />
      <div className={styles.gapText}>
        <span className={styles.gapLine}>
          <FixedDigits
            className={styles.gapValue}
            text={wheelToWheel.slots[slot].gapText}
          />
          <span className={styles.gapUnit}>s</span>
        </span>
        <span className={styles.gapCaption}>{GAP_CAPTION}</span>
      </div>
    </div>
  );
});

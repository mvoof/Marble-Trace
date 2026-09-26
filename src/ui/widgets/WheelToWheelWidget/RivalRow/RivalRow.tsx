import { observer } from 'mobx-react-lite';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { splitDriverName } from '@utils/driver';
import type { RivalSlot } from '../wheel-to-wheel.widget';
import { CarNumberBox } from '../CarNumberBox/CarNumberBox';
import { SideSpeed } from '../SideSpeed/SideSpeed';
import { SpeedBar } from '../SpeedBar/SpeedBar';
import { SLOT_ROLE, formatSlotPosition } from '../slot-labels';

import styles from './RivalRow.module.scss';

interface RivalRowProps {
  slot: RivalSlot;
}

const NO_DRIVER = '—';

/**
 * A rival at half height, for when there is one on each side of you. Half the
 * height leaves room for the surname only — the part read at speed anyway.
 */
export const RivalRow = observer(({ slot }: RivalRowProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  const identity = wheelToWheel.slots[slot].identity;
  const surname = identity ? splitDriverName(identity.name).surname : NO_DRIVER;

  return (
    <div className={styles.row}>
      <div className={styles.line}>
        <SideSpeed slot={slot} compact />

        <div className={styles.names}>
          <span className={styles.role}>
            {SLOT_ROLE[slot]}
            <span className={styles.position}>
              {formatSlotPosition(identity?.position)}
            </span>
          </span>
          <span className={styles.name}>{surname}</span>
        </div>

        <CarNumberBox slot={slot} compact />
      </div>

      <SpeedBar slot={slot} compact />
    </div>
  );
});

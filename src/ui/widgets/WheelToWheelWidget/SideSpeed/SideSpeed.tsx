import { observer } from 'mobx-react-lite';

import {
  useUnitsStore,
  useWheelToWheelWidgetStore,
} from '@store/root-store-context';
import { FixedDigits } from '@ui/shared/FixedDigits/FixedDigits';
import { speedUnit } from '@utils/telemetry-format';
import type { BattleSlot } from '../wheel-to-wheel.widget';

import styles from './SideSpeed.module.scss';

interface SideSpeedProps {
  slot: BattleSlot;
  compact?: boolean;
}

export const SideSpeed = observer(({ slot, compact }: SideSpeedProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();
  const units = useUnitsStore();

  return (
    <div className={`${styles.speed} ${compact ? styles.speedCompact : ''}`}>
      <FixedDigits
        className={styles.value}
        text={wheelToWheel.slots[slot].speedText}
      />
      <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
    </div>
  );
});

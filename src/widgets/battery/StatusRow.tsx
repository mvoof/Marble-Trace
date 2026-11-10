import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@entities/player/player-context';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import {
  formatLapDeployMj,
  formatMguPowerMagnitude,
  formatMguPowerSign,
  mguPowerState,
  type MguPowerState,
} from './battery-utils';
import styles from './BatteryWidget.module.scss';

const STATE_LABEL: Record<MguPowerState, string> = {
  deploy: 'DEPLOY',
  regen: 'REGEN',
  idle: 'IDLE',
};

// Regen is energy gained; deploy is energy spent on purpose, a fact rather
// than a loss; idle has nothing to say.
const STATE_TONE: Record<MguPowerState, StatChipTone> = {
  deploy: 'info',
  regen: 'positive',
  idle: 'muted',
};

const POWER_CLASS: Record<MguPowerState, string> = {
  deploy: styles.powerDeploy,
  regen: styles.powerRegen,
  idle: styles.powerIdle,
};

interface StatusRowProps {
  showPower: boolean;
  showLapDeploy: boolean;
}

/**
 * What the MGU-K is doing, as a quiet chip on the left, and its power as the
 * block's figure on the right — coloured by the state while it flows, white at
 * rest. The energy sent to it this lap rides beside the state as a chip.
 */
export const StatusRow = observer(
  ({ showPower, showLapDeploy }: StatusRowProps) => {
    const { carStatus } = usePlayerStore();

    const watts = carStatus?.power_mgu_k ?? null;
    const state = mguPowerState(watts);
    const joules = carStatus?.energy_battery_to_mgu_k_lap ?? null;

    return (
      <div className={styles.statusRow}>
        <div className={styles.statusChips}>
          {showPower ? (
            <StatChip
              lead={STATE_LABEL[state]}
              look="reading"
              tone={STATE_TONE[state]}
            />
          ) : null}

          {showLapDeploy ? (
            <StatChip lead="LAP" look="reading" tone="neutral">
              <FixedDigits text={formatLapDeployMj(joules)} />
              <span className={styles.chipUnit}>MJ</span>
            </StatChip>
          ) : null}
        </div>

        {showPower ? (
          <div className={`${styles.power} ${POWER_CLASS[state]}`}>
            <span className={styles.powerSign}>
              {formatMguPowerSign(watts)}
            </span>
            <FixedDigits
              className={styles.powerValue}
              text={formatMguPowerMagnitude(watts)}
            />
            <span className={styles.powerUnit}>kW</span>
          </div>
        ) : null}
      </div>
    );
  }
);

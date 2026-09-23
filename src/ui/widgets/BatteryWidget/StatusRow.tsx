import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/shared/FixedDigits/FixedDigits';
import {
  formatLapDeployMj,
  formatMguPowerKw,
  mguPowerState,
} from './battery-utils';
import styles from './BatteryWidget.module.scss';

const STATE_LABEL = {
  deploy: 'DEPLOY',
  regen: 'REGEN',
  idle: 'IDLE',
} as const;

const STATE_CLASS = {
  deploy: styles.stateDeploy,
  regen: styles.stateRegen,
  idle: styles.stateIdle,
} as const;

interface StatusRowProps {
  showPower: boolean;
  showLapDeploy: boolean;
}

/**
 * What the MGU-K is doing and the energy sent to it this lap, as one line of
 * text — a debrief readout, not a control, so it takes no bar and no icon of
 * its own. Each half carries its label on the left and its value on the right,
 * so the two values land in columns rather than drifting with the label width.
 */
export const StatusRow = observer(
  ({ showPower, showLapDeploy }: StatusRowProps) => {
    const { carStatus } = usePlayerStore();

    const watts = carStatus?.power_mgu_k ?? null;
    const state = mguPowerState(watts);
    const joules = carStatus?.energy_battery_to_mgu_k_lap ?? null;

    return (
      <div className={styles.statusRow}>
        {showPower ? (
          <div className={styles.statusItem}>
            <span className={`${styles.powerState} ${STATE_CLASS[state]}`}>
              {STATE_LABEL[state]}
            </span>
            <span className={`${styles.powerValue} ${STATE_CLASS[state]}`}>
              <FixedDigits text={formatMguPowerKw(watts)} />
              <span className={styles.powerUnit}> kW</span>
            </span>
          </div>
        ) : null}

        {showPower && showLapDeploy ? (
          <div className={styles.statusDivider} />
        ) : null}

        {showLapDeploy ? (
          <div className={styles.statusItem}>
            <span className={`${styles.powerState} ${styles.lapLabel}`}>
              LAP
            </span>
            <span className={`${styles.powerValue} ${styles.lapValue}`}>
              <FixedDigits text={formatLapDeployMj(joules)} />
              <span className={styles.powerUnit}> MJ</span>
            </span>
          </div>
        ) : null}
      </div>
    );
  }
);

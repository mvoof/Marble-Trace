import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/widgets/TimerWidget/FixedDigits/FixedDigits';
import { formatMguPowerKw, mguPowerState } from './battery-utils';
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

/** What the MGU-K is doing, and how hard. */
export const PowerRow = observer(() => {
  const { carStatus } = usePlayerStore();

  const watts = carStatus?.power_mgu_k ?? null;
  const state = mguPowerState(watts);

  return (
    <div className={styles.powerRow}>
      <div className={`${styles.powerState} ${STATE_CLASS[state]}`}>
        {STATE_LABEL[state]}
      </div>
      <div className={styles.spacer} />
      <div className={`${styles.powerValue} ${STATE_CLASS[state]}`}>
        <FixedDigits text={formatMguPowerKw(watts)} />
        <span className={styles.powerUnit}> kW</span>
      </div>
    </div>
  );
});

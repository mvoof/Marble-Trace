import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@entities/player/player-context';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { ChargeBar } from './ChargeBar';
import {
  chargeLevel,
  formatChargePct,
  type ChargeLevel,
} from './battery-utils';
import styles from './BatteryWidget.module.scss';

const LEVEL_TONE: Record<ChargeLevel, StatChipTone> = {
  full: 'positive',
  low: 'accent',
  critical: 'danger',
};

const DIVIDER_CLASS: Record<ChargeLevel, string> = {
  full: styles.chargeValueFull,
  low: styles.chargeValueLow,
  critical: styles.chargeValueCritical,
};

/**
 * The charge readout: the label sits over the bar it names, and the percentage
 * stands beside the pair — the number is the thing read from a distance, the
 * bar the thing glanced at. The label, the bar and the rule before the number
 * share the charge's colour.
 */
export const ChargeRow = observer(() => {
  const { carStatus } = usePlayerStore();

  const charge = carStatus?.energy_ers_battery_pct ?? null;
  const level = chargeLevel(Math.min(Math.max(charge ?? 0, 0), 1));

  return (
    <div className={styles.chargeRow}>
      <div className={styles.chargeMeter}>
        <div className={styles.chargeLabel}>
          <StatChip
            lead="BAT"
            look="reading"
            tone={LEVEL_TONE[level]}
            className={styles.batChip}
          />
        </div>
        <ChargeBar />
      </div>

      <div className={`${styles.chargeValue} ${DIVIDER_CLASS[level]}`}>
        <FixedDigits
          className={styles.chargeDigits}
          text={formatChargePct(charge)}
        />
        <span className={styles.chargeUnit}>%</span>
      </div>
    </div>
  );
});

import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import styles from './FuelStatsCell.module.scss';

export type FuelStatTone = 'neutral' | 'positive' | 'danger';

const TONE_CLASSES: Record<FuelStatTone, string> = {
  neutral: '',
  positive: styles.consumptionPositive,
  danger: styles.consumptionDanger,
};

interface FuelStatsCellProps {
  label: string;
  consumption: string;
  /** Laps the tank covers at this consumption. */
  laps: string;
  tone: FuelStatTone;
}

export const FuelStatsCell = observer(
  ({ label, consumption, laps, tone }: FuelStatsCellProps) => {
    return (
      <div className={styles.cell}>
        <span className={styles.label}>{label}</span>

        <FixedDigits
          className={`${styles.consumption} ${TONE_CLASSES[tone]}`}
          text={consumption}
        />

        <StatChip size="xs" className={styles.lapsChip}>
          <FixedDigits text={laps} /> lap
        </StatChip>
      </div>
    );
  }
);

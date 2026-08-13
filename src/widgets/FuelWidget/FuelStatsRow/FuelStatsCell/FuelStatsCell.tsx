import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import styles from './FuelStatsCell.module.scss';

interface FuelStatsCellProps {
  label: string;
  consumption: string;
  laps: string;
}

export const FuelStatsCell = observer(
  ({ label, consumption, laps }: FuelStatsCellProps) => {
    return (
      <div className={styles.cell}>
        <WidgetLabel className={styles.label}>{label}</WidgetLabel>

        <span className={styles.consumption}>{consumption}</span>

        <span className={styles.laps}>
          {laps}

          <span className={styles.lapsUnit}>lap</span>
        </span>
      </div>
    );
  }
);

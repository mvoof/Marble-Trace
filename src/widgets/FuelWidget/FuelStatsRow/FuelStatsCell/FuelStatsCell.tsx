import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import styles from './FuelStatsCell.module.scss';

interface FuelStatsCellProps {
  label: string;
  consumption: string;
}

export const FuelStatsCell = observer(
  ({ label, consumption }: FuelStatsCellProps) => {
    return (
      <div className={styles.cell}>
        <WidgetLabel className={styles.label}>{label}</WidgetLabel>

        <span className={styles.consumption}>{consumption}</span>
      </div>
    );
  }
);

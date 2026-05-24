import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import styles from './FuelDataCell.module.scss';

interface FuelDataCellProps {
  label: string;
  value: string;
  valueClassName?: string;
}

export const FuelDataCell = observer(
  ({ label, value, valueClassName }: FuelDataCellProps) => {
    return (
      <div className={styles.gridCell}>
        <WidgetLabel className={styles.cellLabel}>{label}</WidgetLabel>

        <span className={`${styles.cellValue} ${valueClassName ?? ''}`}>
          {value}
        </span>
      </div>
    );
  }
);

import { observer } from 'mobx-react-lite';

import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import styles from './FuelDataCell.module.scss';

interface FuelDataCellProps {
  label: string;
  value: string;
  unit?: string;
  valueClassName?: string;
}

export const FuelDataCell = observer(
  ({ label, value, unit, valueClassName }: FuelDataCellProps) => {
    return (
      <div className={styles.gridCell}>
        <WidgetLabel className={styles.cellLabel}>{label}</WidgetLabel>

        <WidgetValue
          value={value}
          unit={unit}
          className={`${styles.cellValue} ${valueClassName ?? ''}`}
          unitClassName={styles.cellUnit}
        />
      </div>
    );
  }
);

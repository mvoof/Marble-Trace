import { observer } from 'mobx-react-lite';

import { UnitLabelText } from '@/components/shared/UnitLabelText/UnitLabelText';
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
        <UnitLabelText className={styles.cellLabel}>{label}</UnitLabelText>
        <span className={`${styles.cellValue} ${valueClassName ?? ''}`}>
          {value}
        </span>
      </div>
    );
  }
);

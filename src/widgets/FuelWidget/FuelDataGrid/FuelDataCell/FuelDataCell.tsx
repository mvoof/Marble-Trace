import { observer } from 'mobx-react-lite';

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
        <span className={styles.cellLabel}>{label}</span>
        <span className={`${styles.cellValue} ${valueClassName ?? ''}`}>
          {value}
        </span>
      </div>
    );
  }
);

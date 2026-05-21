import { observer } from 'mobx-react-lite';

import styles from './TireTempCell.module.scss';

interface TireTempCellProps {
  value: number | null;
  color: string;
  unit: string;
}

export const TireTempCell = observer(
  ({ value, color, unit }: TireTempCellProps) => (
    <span className={styles.tempValue} style={{ color }}>
      {value != null ? Math.round(value) : '--'}

      <span className={styles.tempUnit}>{unit}</span>
    </span>
  )
);

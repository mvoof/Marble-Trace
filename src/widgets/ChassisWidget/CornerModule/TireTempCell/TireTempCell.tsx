import { observer } from 'mobx-react-lite';

import { UnitValueText } from '@/components/shared/primitives/UnitValueText/UnitValueText';
import styles from './TireTempCell.module.scss';

interface TireTempCellProps {
  value: number | null;
  color: string;
  unit: string;
}

export const TireTempCell = observer(
  ({ value, color, unit }: TireTempCellProps) => (
    <UnitValueText
      value={value != null ? Math.round(value) : '--'}
      unit={unit}
      color={color}
      className={styles.tempValue}
    />
  )
);

import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import styles from './TireTempCell.module.scss';

interface TireTempCellProps {
  value: number | null;
  color: string;
  unit: string;
}

export const TireTempCell = observer(
  ({ value, color, unit }: TireTempCellProps) => (
    <WidgetValue
      value={value != null ? Math.round(value) : '--'}
      unit={unit}
      color={color}
      className={styles.tempValue}
    />
  )
);

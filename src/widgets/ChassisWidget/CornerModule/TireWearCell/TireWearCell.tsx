import { observer } from 'mobx-react-lite';

import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import styles from './TireWearCell.module.scss';

interface TireWearCellProps {
  wear: number | null;
}

export const TireWearCell = observer(({ wear }: TireWearCellProps) => (
  <WidgetValue value={wear ?? '--'} unit="%" className={styles.wearValue} />
));

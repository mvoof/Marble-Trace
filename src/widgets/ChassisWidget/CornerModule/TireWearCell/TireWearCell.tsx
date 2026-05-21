import { observer } from 'mobx-react-lite';

import { UnitValueText } from '@/components/shared/primitives/UnitValueText/UnitValueText';
import styles from './TireWearCell.module.scss';

interface TireWearCellProps {
  wear: number | null;
}

export const TireWearCell = observer(({ wear }: TireWearCellProps) => (
  <UnitValueText value={wear ?? '--'} unit="%" className={styles.wearValue} />
));

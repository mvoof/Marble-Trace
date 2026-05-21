import { observer } from 'mobx-react-lite';

import styles from './TireWearCell.module.scss';

interface TireWearCellProps {
  wear: number | null;
}

export const TireWearCell = observer(({ wear }: TireWearCellProps) => (
  <span className={styles.wearValue}>
    {wear ?? '--'}

    <span className={styles.wearUnit}>%</span>
  </span>
));

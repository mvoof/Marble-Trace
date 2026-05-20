import { observer } from 'mobx-react-lite';

import styles from './CornerModule.module.scss';

interface SuspensionTextProps {
  value: string;
  unit: string;
  color?: string;
}

export const SuspensionText = observer(
  ({ value, unit, color = '#fff' }: SuspensionTextProps) => (
    <div className={styles.suspensionAndBrakesRow}>
      <span className={styles.suspensionAndBrakesValue} style={{ color }}>
        {value}
      </span>
      <span className={styles.suspensionAndBrakesUnit} style={{ color }}>
        {unit}
      </span>
    </div>
  )
);

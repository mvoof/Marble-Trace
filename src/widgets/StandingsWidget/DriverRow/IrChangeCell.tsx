import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import styles from './DriverRow.module.scss';

interface IrChangeCellProps {
  delta: number | undefined;
}

export const IrChangeCell = observer(({ delta }: IrChangeCellProps) => {
  if (delta == null || delta === 0) {
    return <span className={styles.irChange}>-</span>;
  }

  const cls =
    delta > 0
      ? `${styles.irChange} ${styles.irChangeUp}`
      : `${styles.irChange} ${styles.irChangeDown}`;

  return (
    <span className={cls}>
      {delta > 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      {Math.abs(delta)}
    </span>
  );
});

import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import styles from './DriverRow.module.scss';

interface PosChangeProps {
  position: number;
  startPos: number;
}

export const PosChange = observer(({ position, startPos }: PosChangeProps) => {
  if (startPos === 0) {
    return <span className={styles.posChangeNeutral}>-</span>;
  }

  const diff = startPos - position;

  if (diff > 0) {
    return (
      <span className={styles.posChangeUp}>
        <ChevronUp size={12} />
        {diff}
      </span>
    );
  }

  if (diff < 0) {
    return (
      <span className={styles.posChangeDown}>
        <ChevronDown size={12} />
        {Math.abs(diff)}
      </span>
    );
  }

  return <span className={styles.posChangeNeutral}>-</span>;
});

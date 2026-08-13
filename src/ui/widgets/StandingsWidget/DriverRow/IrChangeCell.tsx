import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import styles from './DriverRow.module.scss';
import { useStandingsWidgetStore } from '@store/root-store-context';

interface IrChangeCellProps {
  carIdx: number;
}

export const IrChangeCell = observer(({ carIdx }: IrChangeCellProps) => {
  const standingsWidget = useStandingsWidgetStore();

  const entry = standingsWidget.driverMap.get(carIdx);

  // Both projections ride on every frame; the table's own ordering picks which one
  // is honest here — a gain shown against an order the table is not drawing reads
  // as a contradiction.
  const delta = standingsWidget.useTrackOrder
    ? entry?.estimatedIrDeltaLive
    : entry?.estimatedIrDeltaOfficial;

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

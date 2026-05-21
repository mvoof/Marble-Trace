import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';

import styles from './DriverRow.module.scss';

interface PosChangeProps {
  carIdx: number;
}

export const PosChange = observer(({ carIdx }: PosChangeProps) => {
  const driver = computedStore.driverMap.get(carIdx);
  const settings = widgetSettingsStore.getStandingsSettings();
  const effectiveStartPos = computedStore.getEffectiveStartPos(carIdx);

  if (!driver) {
    return null;
  }

  const position = settings.enableClassCycling
    ? driver.classPosition
    : driver.position;

  const startPos = settings.enableClassCycling
    ? effectiveStartPos.class
    : effectiveStartPos.overall;

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

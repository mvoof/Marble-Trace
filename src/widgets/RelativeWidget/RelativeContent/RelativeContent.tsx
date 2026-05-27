import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@hooks/common/useVisibleRowCount';
import { DriverRow } from '@widgets/RelativeWidget/DriverRow/DriverRow';

import styles from './RelativeContent.module.scss';
import { useBackendComputedStore } from '@store/root-store-context';

export const RelativeContent = observer(() => {
  const computed = useBackendComputedStore();

  const entries = computed.relativeEntries;

  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2.75, 3, '[data-relative-row]');

  const displayEntries = useMemo(() => {
    const playerIdx = entries.findIndex((entry) => entry.isPlayer);

    if (playerIdx === -1) {
      return entries.slice(0, visibleRowCount);
    }

    const total = Math.min(visibleRowCount, entries.length);
    const half = Math.floor(total / 2);

    const aboveAvail = playerIdx;
    const belowAvail = entries.length - playerIdx - 1;

    let above = Math.min(half, aboveAvail);
    const below = Math.min(total - 1 - above, belowAvail);

    above = Math.min(total - 1 - below, aboveAvail);

    return entries.slice(playerIdx - above, playerIdx + below + 1);
  }, [entries, visibleRowCount]);

  return (
    <div ref={driverListRef} className={styles.driverList}>
      {displayEntries.map((entry) => (
        <DriverRow key={entry.carIdx} driver={entry} />
      ))}
    </div>
  );
});

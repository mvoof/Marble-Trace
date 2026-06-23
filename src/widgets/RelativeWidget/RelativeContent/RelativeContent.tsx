import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@hooks/common/useVisibleRowCount';
import { DriverRow } from '@widgets/RelativeWidget/DriverRow/DriverRow';
import { NoDataPlaceholder } from '@/components/shared/NoDataPlaceholder/NoDataPlaceholder';
import {
  useBackendComputedStore,
  useSimStore,
} from '@store/root-store-context';

import styles from './RelativeContent.module.scss';

export const RelativeContent = observer(() => {
  const computed = useBackendComputedStore();
  const sim = useSimStore();

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

  const hasData = sim.isConnected && entries.length > 0;

  if (!hasData) {
    return <NoDataPlaceholder />;
  }

  return (
    <div ref={driverListRef} className={styles.driverList}>
      {displayEntries.map((entry, index) => (
        <DriverRow key={entry.carIdx} driver={entry} index={index} />
      ))}
    </div>
  );
});

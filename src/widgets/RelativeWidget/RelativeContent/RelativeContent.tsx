import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@hooks/common/useVisibleRowCount';
import { DriverRow } from '@widgets/RelativeWidget/DriverRow/DriverRow';
import { NoDataPlaceholder } from '@/components/shared/NoDataPlaceholder/NoDataPlaceholder';
import {
  useBackendComputedStore,
  useSimStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './RelativeContent.module.scss';

export const RelativeContent = observer(() => {
  const computed = useBackendComputedStore();
  const sim = useSimStore();
  const widgetSettings = useWidgetSettingsStore();

  const { rowPadding } =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const entries = computed.relativeEntries;

  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      rowPadding === 'wide' ? 3.5 : rowPadding === 'medium' ? 3.25 : 2.75,
      3,
      '[data-relative-row]',
      [rowPadding]
    );

  const displayEntries = useMemo(() => {
    const playerIdx = entries.findIndex((entry) => entry.isPlayer);

    if (playerIdx === -1) {
      return entries.slice(0, visibleRowCount);
    }

    // Force an odd window so the player can sit dead-centre with an equal
    // number of rows above and below. On resize, rows are then added/removed
    // symmetrically from both ends — the player row never shifts position.
    let total = Math.min(visibleRowCount, entries.length);

    if (total % 2 === 0 && total > 1) {
      total -= 1;
    }

    const aboveAvail = playerIdx;
    const belowAvail = entries.length - playerIdx - 1;
    const half = (total - 1) / 2;

    let above = Math.min(half, aboveAvail);
    let below = Math.min(half, belowAvail);
    // Reclaim the opposite side's unused budget when the player is near an edge.
    above = Math.min(total - 1 - below, aboveAvail);
    below = Math.min(total - 1 - above, belowAvail);

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

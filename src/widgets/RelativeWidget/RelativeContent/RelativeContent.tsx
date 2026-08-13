import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@ui/hooks/useVisibleRowCount';
import { DriverRow } from '@ui/widgets/RelativeWidget/DriverRow/DriverRow';
import { PaceCarRow } from '@ui/widgets/RelativeWidget/PaceCarRow/PaceCarRow';
import { NoDataPlaceholder } from '@ui/shared/NoDataPlaceholder/NoDataPlaceholder';
import {
  buildPaceCarRowEntries,
  mergePaceCarRows,
} from '@ui/widgets/RelativeWidget/relative-utils';
import {
  useBackendComputedStore,
  useCarsStore,
  usePaceCarStore,
  useSessionStore,
  useSimStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './RelativeContent.module.scss';

export const RelativeContent = observer(() => {
  const computed = useBackendComputedStore();
  const sim = useSimStore();
  const { carIdx } = useCarsStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();
  const paceCarStore = usePaceCarStore();

  const { rowPadding, paceCarShowInPits } =
    widgetSettings.getSettings<RelativeWidgetSettings>('relative');

  const paceCarEntries = buildPaceCarRowEntries(
    carIdx,
    sessionInfo?.cars,
    computed.relativeEntries,
    (entryCarIdx) => paceCarStore.getPitPhase(entryCarIdx),
    paceCarShowInPits ?? false
  );

  const entries = mergePaceCarRows(computed.relativeEntries, paceCarEntries);

  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      rowPadding === 'wide' ? 3.5 : rowPadding === 'medium' ? 3.25 : 2.75,
      3,
      '[data-relative-row]'
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
      {displayEntries.map((entry, index) =>
        'isPaceCar' in entry ? (
          <PaceCarRow key={entry.carIdx} driver={entry} index={index} />
        ) : (
          <DriverRow key={entry.carIdx} driver={entry} index={index} />
        )
      )}
    </div>
  );
});

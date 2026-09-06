import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@ui/hooks/useVisibleRowCount';
import { DriverRow } from '@ui/widgets/RelativeWidget/DriverRow/DriverRow';
import { PaceCarRow } from '@ui/widgets/RelativeWidget/PaceCarRow/PaceCarRow';
import { NoDataPlaceholder } from '@ui/shared/NoDataPlaceholder/NoDataPlaceholder';
import {
  useBackendComputedStore,
  useRelativeWidgetStore,
  useSimStore,
} from '@store/root-store-context';
import type { RelativeWidgetSettings } from '@/types/widget-settings';

import styles from './RelativeContent.module.scss';

const WIDE_ROW_HEIGHT = 3.5;
const MEDIUM_ROW_HEIGHT = 3.25;
const NARROW_ROW_HEIGHT = 2.75;
const MIN_VISIBLE_ROWS = 3;

/**
 * The strip around the player. The order comes from the widget store as a list
 * of car indices compared by content, so a burst that moves every car without
 * changing who is where re-renders nothing here — each row reads its own driver
 * and writes its own gap. See `docs/rendering.md`.
 */
export const RelativeContent = observer(function RelativeContent() {
  const computed = useBackendComputedStore();
  const relativeWidget = useRelativeWidgetStore();
  const sim = useSimStore();

  const { rowPadding } = useWidgetSettings<RelativeWidgetSettings>('relative');

  const rows = relativeWidget.rowOrder;

  const playerCarIdx = computed.relativeIdentities.find(
    (identity) => identity.isPlayer
  )?.carIdx;

  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      rowPadding === 'wide'
        ? WIDE_ROW_HEIGHT
        : rowPadding === 'medium'
          ? MEDIUM_ROW_HEIGHT
          : NARROW_ROW_HEIGHT,
      MIN_VISIBLE_ROWS,
      '[data-relative-row]'
    );

  const displayRows = useMemo(() => {
    const playerIdx = rows.findIndex((row) => row.carIdx === playerCarIdx);

    if (playerIdx === -1) {
      return rows.slice(0, visibleRowCount);
    }

    // Force an odd window so the player can sit dead-centre with an equal
    // number of rows above and below. On resize, rows are then added/removed
    // symmetrically from both ends — the player row never shifts position.
    let total = Math.min(visibleRowCount, rows.length);

    if (total % 2 === 0 && total > 1) {
      total -= 1;
    }

    const aboveAvail = playerIdx;
    const belowAvail = rows.length - playerIdx - 1;
    const half = (total - 1) / 2;

    let above = Math.min(half, aboveAvail);
    let below = Math.min(half, belowAvail);
    // Reclaim the opposite side's unused budget when the player is near an edge.
    above = Math.min(total - 1 - below, aboveAvail);
    below = Math.min(total - 1 - above, belowAvail);

    return rows.slice(playerIdx - above, playerIdx + below + 1);
  }, [rows, playerCarIdx, visibleRowCount]);

  const hasData = sim.isConnected && rows.length > 0;

  if (!hasData) {
    return <NoDataPlaceholder />;
  }

  return (
    <div ref={driverListRef} className={styles.driverList}>
      {displayRows.map((row, index) =>
        row.isPaceCar ? (
          <PaceCarRow key={row.carIdx} carIdx={row.carIdx} index={index} />
        ) : (
          <DriverRow key={row.carIdx} carIdx={row.carIdx} index={index} />
        )
      )}
    </div>
  );
});

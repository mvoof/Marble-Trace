import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { useVisibleRowCount } from '@shared/hooks/useVisibleRowCount';
import { DriverRow } from '@widgets/relative/DriverRow/DriverRow';
import { PaceCarRow } from '@widgets/relative/PaceCarRow/PaceCarRow';
import { NoDataPlaceholder } from '@shared/ui/NoDataPlaceholder/NoDataPlaceholder';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useSimStore } from '@entities/sim/sim-context';
import { useRelativeWidgetStore } from '@widgets/relative/relative.store';

import styles from './RelativeContent.module.scss';
import type { RelativeWidgetSettings } from '../settings-schema';

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
export const RelativeContent = observer(() => {
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

    // Every row the height allows is drawn, one at a time as the widget grows,
    // as the standings do. An odd window centres the player; an even one gives
    // its extra row to the cars ahead.
    const total = Math.min(visibleRowCount, rows.length);

    const aboveAvail = playerIdx;
    const belowAvail = rows.length - playerIdx - 1;
    const others = total - 1;

    let above = Math.min(Math.ceil(others / 2), aboveAvail);
    let below = Math.min(Math.floor(others / 2), belowAvail);
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

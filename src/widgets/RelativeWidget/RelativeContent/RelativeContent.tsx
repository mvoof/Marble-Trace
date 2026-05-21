import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { useVisibleRowCount } from '@hooks/common/useVisibleRowCount';
import { DriverRow } from '@widgets/RelativeWidget/DriverRow/DriverRow';
import { computeRelativeGap } from '@utils/widget/relative-utils';
import { TREND_SAMPLE_INTERVAL_MS } from '@utils/widget/widget-utils';

import styles from './RelativeContent.module.scss';

export const RelativeContent = observer(() => {
  const entries = computedStore.relativeEntries;
  const settings = widgetSettingsStore.getRelativeSettings();

  const prevGapTimesRef = useRef<Map<number, number>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(0);

  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2.75, 3, '[data-relative-row]');

  const [trendMap, setTrendMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const now = Date.now();

    if (now - lastSnapshotTimeRef.current < TREND_SAMPLE_INTERVAL_MS) {
      return;
    }

    const prevSnapshot = prevGapTimesRef.current;
    const newTrends = new Map<number, number>();
    const playerEntry = entries.find((entry) => entry.isPlayer);

    if (playerEntry) {
      for (const entry of entries) {
        if (entry.isPlayer) {
          continue;
        }

        const prevGap = prevSnapshot.get(entry.carIdx);
        const currGap = computeRelativeGap(entry, playerEntry);

        if (prevGap === undefined) {
          continue;
        }

        const gapDelta = currGap - prevGap;

        if (Math.abs(gapDelta) > 0.01) {
          newTrends.set(entry.carIdx, gapDelta);
        }
      }
    }

    setTrendMap(newTrends);

    const newTimes = new Map<number, number>();

    for (const entry of entries) {
      if (entry.isPlayer || !playerEntry) {
        continue;
      }

      newTimes.set(entry.carIdx, computeRelativeGap(entry, playerEntry));
    }

    prevGapTimesRef.current = newTimes;
    lastSnapshotTimeRef.current = now;
  }, [entries]);

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

  const player = entries.find((entry) => entry.isPlayer);

  return (
    <div ref={driverListRef} className={styles.driverList}>
      {displayEntries.map((entry) => (
        <DriverRow
          key={entry.carIdx}
          driver={entry}
          player={player ?? null}
          trendDelta={trendMap.get(entry.carIdx) ?? 0}
          settings={settings}
        />
      ))}
    </div>
  );
});

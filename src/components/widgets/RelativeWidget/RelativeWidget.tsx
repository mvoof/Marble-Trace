import { useEffect, useMemo, useRef, useState } from 'react';

import { WidgetPanel } from '../primitives';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';

import { DriverRow } from './DriverRow/DriverRow';
import { TREND_SAMPLE_INTERVAL_MS } from './relative-utils';
import type { RelativeEntry } from './types';

import styles from './RelativeWidget.module.scss';

interface RelativeWidgetProps {
  entries: RelativeEntry[];
}

export const RelativeWidget = ({ entries }: RelativeWidgetProps) => {
  const prevF2TimesRef = useRef<Map<number, number>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(0);
  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2.75, 3, '[data-relative-row]');

  const [trendMap, setTrendMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const now = Date.now();
    if (now - lastSnapshotTimeRef.current < TREND_SAMPLE_INTERVAL_MS) return;

    const prevSnapshot = prevF2TimesRef.current;
    const newTrends = new Map<number, number>();
    const playerEntry = entries.find((e) => e.isPlayer);

    if (playerEntry) {
      const prevPlayerF2 = prevSnapshot.get(playerEntry.carIdx);

      for (const entry of entries) {
        if (entry.isPlayer) continue;

        const prevEntryF2 = prevSnapshot.get(entry.carIdx);
        if (prevEntryF2 === undefined || prevPlayerF2 === undefined) continue;

        const currRelGap = entry.f2Time - playerEntry.f2Time;
        const prevRelGap = prevEntryF2 - prevPlayerF2;
        const gapDelta = currRelGap - prevRelGap;

        if (Math.abs(gapDelta) > 0.01) {
          newTrends.set(entry.carIdx, gapDelta);
        }
      }
    }

    setTrendMap(newTrends);

    const newTimes = new Map<number, number>();
    for (const entry of entries) {
      newTimes.set(entry.carIdx, entry.f2Time);
    }
    prevF2TimesRef.current = newTimes;
    lastSnapshotTimeRef.current = now;
  }, [entries]);

  const displayEntries = useMemo((): RelativeEntry[] => {
    const total = visibleRowCount;
    const half = Math.floor(total / 2);
    const playerIdx = entries.findIndex((e) => e.isPlayer);

    if (playerIdx === -1) return entries.slice(0, total);

    const result: RelativeEntry[] = [];

    for (let i = half; i > 0; i -= 1) {
      const idx = playerIdx - i;
      if (idx >= 0) result.push(entries[idx]);
    }

    result.push(entries[playerIdx]);

    const below = total - result.length;
    for (let i = 1; i <= below; i += 1) {
      const idx = playerIdx + i;
      if (idx < entries.length) result.push(entries[idx]);
    }

    return result;
  }, [entries, visibleRowCount]);

  const player = entries.find((e) => e.isPlayer);

  return (
    <WidgetPanel className={styles.relative} gap={0}>
      <div ref={driverListRef} className={styles.driverList}>
        {displayEntries.map((entry) => (
          <DriverRow
            key={entry.carIdx}
            driver={entry}
            player={player ?? null}
            trendDelta={trendMap.get(entry.carIdx) ?? 0}
          />
        ))}
      </div>
    </WidgetPanel>
  );
};

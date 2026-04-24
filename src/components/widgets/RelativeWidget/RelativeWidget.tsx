import { useEffect, useMemo, useRef, useState } from 'react';

import { WidgetPanel } from '../primitives';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import type { RelativeWidgetSettings } from '../../../types/widget-settings';

import { DriverRow } from './DriverRow/DriverRow';
import { TREND_SAMPLE_INTERVAL_MS } from '../widget-utils';
import type { DriverEntry } from '../../../types/bindings';

import styles from './RelativeWidget.module.scss';

interface RelativeWidgetProps {
  entries: DriverEntry[];
  settings: RelativeWidgetSettings;
}

export const RelativeWidget = ({ entries, settings }: RelativeWidgetProps) => {
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

  const displayEntries = useMemo((): DriverEntry[] => {
    const playerIdx = entries.findIndex((e) => e.isPlayer);

    if (playerIdx === -1) return entries.slice(0, visibleRowCount);

    const total = Math.min(visibleRowCount, entries.length);
    const half = Math.floor(total / 2);

    const aboveAvail = playerIdx;
    const belowAvail = entries.length - playerIdx - 1;

    let above = Math.min(half, aboveAvail);
    let below = Math.min(total - 1 - above, belowAvail);
    above = Math.min(total - 1 - below, aboveAvail);

    return entries.slice(playerIdx - above, playerIdx + below + 1);
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
            settings={settings}
          />
        ))}
      </div>
    </WidgetPanel>
  );
};

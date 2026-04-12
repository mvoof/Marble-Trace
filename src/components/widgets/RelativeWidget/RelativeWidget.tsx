import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { telemetryStore } from '../../../store/iracing';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import {
  parseClassColor,
  formatClassShortName,
} from '../../../utils/class-color';
import type { Driver } from '../../../types/bindings';

import { DriverRow } from './DriverRow/DriverRow';
import { LinearMap } from './LinearMap/LinearMap';
import { TREND_SAMPLE_INTERVAL_MS } from './relative-utils';
import { isPlaceholder } from './types';
import type { RelativeEntry, PlaceholderEntry } from './types';

import styles from './RelativeWidget.module.scss';

export const RelativeWidget = observer(() => {
  const carIdx = telemetryStore.carIdx;
  const { driverInfo } = telemetryStore;
  const settings = widgetSettingsStore.getRelativeSettings();
  const prevF2TimesRef = useRef<Map<number, number>>(new Map());
  const prevF2PctRef = useRef<Map<number, number>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(0);
  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2.75, 3, '[data-relative-row]');

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const entries = useMemo((): RelativeEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    const playerLapDistPct =
      playerCarIdx >= 0 ? (carIdx.car_idx_lap_dist_pct[playerCarIdx] ?? 0) : 0;

    const relativeDiff = (other: number): number => {
      let diff = other - playerLapDistPct;
      if (diff < -0.5) diff += 1;
      if (diff > 0.5) diff -= 1;
      return diff;
    };

    return drivers
      .filter((d) => {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        if (idx === playerCarIdx) return true;
        const pos = carIdx.car_idx_position[idx] ?? 0;
        const lapDistPct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
        if (pos > 0) return true;
        if (lapDistPct >= 0) return true;
        return false;
      })
      .map((d): RelativeEntry => {
        const idx = d.CarIdx;
        const rawClass =
          d.CarClassShortName ||
          (d.CarClassRelSpeed != null
            ? `Class ${d.CarClassRelSpeed}`
            : 'Class');
        const classLabel = formatClassShortName(
          rawClass,
          d.CarScreenName,
          d.CarClassID
        );

        return {
          carIdx: idx,
          userName: d.UserName,
          carNumber: d.CarNumber ?? '',
          carClassId: d.CarClassID ?? -1,
          carClass: classLabel,
          carClassShortName: classLabel,
          carClassColor: parseClassColor(d.CarClassColor),
          position: carIdx.car_idx_position[idx] ?? 0,
          lap: carIdx.car_idx_lap?.[idx] ?? 0,
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          iRating: d.IRating ?? 0,
          licString: d.LicString ?? 'R 0.00',
          isPlayer: idx === playerCarIdx,
          onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
        };
      })
      .sort((a, b) => relativeDiff(b.lapDistPct) - relativeDiff(a.lapDistPct));
  }, [carIdx, drivers, playerCarIdx]);

  const [trendMap, setTrendMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    const now = Date.now();
    if (now - lastSnapshotTimeRef.current < TREND_SAMPLE_INTERVAL_MS) return;

    const prevSnapshot = prevF2TimesRef.current;
    const newTrends = new Map<number, number>();
    const playerEntry = entries.find((e) => e.isPlayer);

    for (const entry of entries) {
      if (entry.isPlayer) continue;

      const prevData = prevSnapshot.get(entry.carIdx);
      if (prevData === undefined) continue;

      const f2Delta = entry.f2Time - prevData;
      if (Math.abs(f2Delta) > 0.01) {
        newTrends.set(entry.carIdx, f2Delta);
        continue;
      }

      if (playerEntry) {
        const prevPlayerPct = prevF2PctRef.current.get(playerEntry.carIdx) ?? 0;
        const prevPct = prevF2PctRef.current.get(entry.carIdx) ?? 0;

        let prevGap = prevPct - prevPlayerPct;
        if (prevGap < -0.5) prevGap += 1;
        if (prevGap > 0.5) prevGap -= 1;

        let currGap = entry.lapDistPct - playerEntry.lapDistPct;
        if (currGap < -0.5) currGap += 1;
        if (currGap > 0.5) currGap -= 1;

        const gapDelta = Math.abs(currGap) - Math.abs(prevGap);
        if (Math.abs(gapDelta) > 0.0001) {
          newTrends.set(entry.carIdx, gapDelta);
        }
      }
    }

    setTrendMap(newTrends);

    const newTimes = new Map<number, number>();
    const newPcts = new Map<number, number>();
    for (const entry of entries) {
      newTimes.set(entry.carIdx, entry.f2Time);
      newPcts.set(entry.carIdx, entry.lapDistPct);
    }
    prevF2TimesRef.current = newTimes;
    prevF2PctRef.current = newPcts;
    lastSnapshotTimeRef.current = now;
  }, [entries]);

  const displayEntries = useMemo((): (RelativeEntry | PlaceholderEntry)[] => {
    const total = visibleRowCount;
    const half = Math.floor(total / 2);
    const playerIdx = entries.findIndex((e) => e.isPlayer);

    if (playerIdx === -1) return entries.slice(0, total);

    const result: (RelativeEntry | PlaceholderEntry)[] = [];

    for (let i = half; i > 0; i -= 1) {
      const idx = playerIdx - i;
      if (idx >= 0) result.push(entries[idx]);
      else result.push({ isPlaceholder: true, key: `pad-top-${i}` });
    }

    result.push(entries[playerIdx]);

    const below = total - result.length;
    for (let i = 1; i <= below; i += 1) {
      const idx = playerIdx + i;
      if (idx < entries.length) result.push(entries[idx]);
      else result.push({ isPlaceholder: true, key: `pad-bot-${i}` });
    }

    return result;
  }, [entries, visibleRowCount]);

  const player = entries.find((e) => e.isPlayer);
  const mapPos = settings.linearMapPosition;
  const isHorizontal = mapPos === 'top' || mapPos === 'bottom';
  const showMapFirst = mapPos === 'top' || mapPos === 'left';

  const containerClass = `${styles.relative} ${isHorizontal ? styles.relativeColumn : styles.relativeRow}`;

  return (
    <WidgetPanel
      className={containerClass}
      gap={0}
      direction={isHorizontal ? 'column' : 'row'}
    >
      {settings.showLinearMap && showMapFirst && (
        <LinearMap
          entries={entries}
          player={player ?? null}
          position={mapPos}
          isHorizontal={isHorizontal}
        />
      )}

      <div ref={driverListRef} className={styles.driverList}>
        {displayEntries.map((entry) =>
          isPlaceholder(entry) ? (
            <div key={entry.key} className={styles.driverRowPlaceholder} />
          ) : (
            <DriverRow
              key={entry.carIdx}
              driver={entry}
              player={player ?? null}
              trendDelta={trendMap.get(entry.carIdx) ?? 0}
            />
          )
        )}
      </div>

      {settings.showLinearMap && !showMapFirst && (
        <LinearMap
          entries={entries}
          player={player ?? null}
          position={mapPos}
          isHorizontal={isHorizontal}
        />
      )}
    </WidgetPanel>
  );
});

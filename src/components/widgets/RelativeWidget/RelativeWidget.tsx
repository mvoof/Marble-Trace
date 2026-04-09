import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { WidgetPanel } from '../primitives';
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { parseClassColor } from '../../../utils/class-color';
import type { Driver } from '../../../types/bindings';

import styles from './RelativeWidget.module.scss';

// iRacing class names sometimes include " Class" suffix; widgets use the
// short form (e.g. "GT3", "LMP2"). When iRacing only exposes a generic
// "Class N" we try to derive a category tag from the car screen name.
const CATEGORY_REGEX = /\b(GTP|LMP1|LMP2|LMP3|GTE|GT3|GT4|GT2|TCR|CUP)\b/i;

const deriveClassFromCar = (carName: string | null | undefined): string => {
  if (!carName) return '';
  const m = CATEGORY_REGEX.exec(carName);
  return m ? m[1].toUpperCase() : '';
};

const formatClassShortName = (
  rawClassName: string | null | undefined,
  carScreenName?: string | null
): string => {
  if (rawClassName) {
    const trimmed = rawClassName.replace(/\s*class\s*$/i, '').trim();
    if (/^class\s+\d+$/i.test(rawClassName.trim())) {
      const fromCar = deriveClassFromCar(carScreenName);
      if (fromCar) return fromCar;
      const m = /^class\s+(\d+)$/i.exec(rawClassName.trim());
      return m ? `C${m[1]}` : trimmed;
    }
    if (trimmed) return trimmed;
  }
  return deriveClassFromCar(carScreenName) || '';
};

interface PlaceholderEntry {
  isPlaceholder: true;
  key: string;
}

const isPlaceholder = (
  e: RelativeEntry | PlaceholderEntry
): e is PlaceholderEntry => 'isPlaceholder' in e;

interface RelativeEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClassId: number;
  carClass: string;
  carClassShortName: string;
  carClassColor: string;
  position: number;
  lap: number;
  lapDistPct: number;
  f2Time: number;
  trackSurface: number;
  iRating: number;
  licString: string;
  isPlayer: boolean;
  onPitRoad: boolean;
}

const TRACK_SURFACE_IN_PIT_STALL = 1;
const TRACK_SURFACE_ON_TRACK = 3;

export const RelativeWidget = observer(() => {
  const carIdx = useCarIdx();
  const { driverInfo } = useSession();
  const settings = widgetSettingsStore.getRelativeSettings();
  const prevF2TimesRef = useRef<Map<number, number>>(new Map());
  const prevF2PctRef = useRef<Map<number, number>>(new Map());
  const lastSnapshotTimeRef = useRef<number>(0);
  const { ref: driverListRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2.75, 3);

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const entries = useMemo((): RelativeEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    const playerLapDistPct =
      playerCarIdx >= 0 ? (carIdx.car_idx_lap_dist_pct[playerCarIdx] ?? 0) : 0;

    // Relative position to player (mod 1.0, in range [-0.5, 0.5]).
    // Cars AHEAD have positive diff, BEHIND have negative.
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
        // Always keep the player even when they have no race position yet.
        if (idx === playerCarIdx) return true;
        if (carIdx.car_idx_position[idx] <= 0) return false;
        return true;
      })
      .map((d): RelativeEntry => {
        const idx = d.CarIdx;
        const rawClass =
          d.CarClassShortName ||
          (d.CarClassRelSpeed != null
            ? `Class ${d.CarClassRelSpeed}`
            : 'Class');
        const classLabel =
          formatClassShortName(rawClass, d.CarScreenName) || rawClass;

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

  const TREND_SAMPLE_INTERVAL_MS = 2000;

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

      // Primary: use f2Time delta if f2Time is actually changing
      const f2Delta = entry.f2Time - prevData;
      if (Math.abs(f2Delta) > 0.01) {
        newTrends.set(entry.carIdx, f2Delta);
        continue;
      }

      // Fallback: compute gap trend from lapDistPct relative to player
      if (playerEntry) {
        const prevPlayerData = prevSnapshot.get(playerEntry.carIdx);
        if (prevPlayerData !== undefined) {
          const prevPlayerPct =
            prevF2PctRef.current.get(playerEntry.carIdx) ?? 0;
          const prevPct = prevF2PctRef.current.get(entry.carIdx) ?? 0;

          let prevGap = prevPct - prevPlayerPct;
          if (prevGap < -0.5) prevGap += 1;
          if (prevGap > 0.5) prevGap -= 1;

          let currGap = entry.lapDistPct - playerEntry.lapDistPct;
          if (currGap < -0.5) currGap += 1;
          if (currGap > 0.5) currGap -= 1;

          const gapDelta = Math.abs(currGap) - Math.abs(prevGap);
          if (Math.abs(gapDelta) > 0.0001) {
            // gapDelta > 0 means gap growing (pulling away), < 0 means closing
            // Convert to match f2Time convention: positive = car ahead gaining
            newTrends.set(entry.carIdx, gapDelta);
          }
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

  // Player is ALWAYS rendered in the geometric center of the list. If there
  // are not enough cars above/below, we pad with placeholder rows so the
  // player never drifts away from the middle.
  const displayEntries = useMemo((): (RelativeEntry | PlaceholderEntry)[] => {
    const total = visibleRowCount;
    const half = Math.floor(total / 2);

    const playerIdx = entries.findIndex((e) => e.isPlayer);
    if (playerIdx === -1) {
      // No player in session yet — just clip from the top.
      return entries.slice(0, total);
    }

    const result: (RelativeEntry | PlaceholderEntry)[] = [];

    // Cars above the player (closest gap first → topmost row).
    for (let i = half; i > 0; i -= 1) {
      const idx = playerIdx - i;
      if (idx >= 0) result.push(entries[idx]);
      else result.push({ isPlaceholder: true, key: `pad-top-${i}` });
    }

    result.push(entries[playerIdx]);

    // Cars below the player.
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

const DriverRow = observer(
  ({
    driver,
    player,
    trendDelta,
  }: {
    driver: RelativeEntry;
    player: RelativeEntry | null;
    trendDelta: number;
  }) => {
    const isPit =
      driver.trackSurface === TRACK_SURFACE_IN_PIT_STALL || driver.onPitRoad;

    let lapStatus: 'lapping' | 'lapped' | null = null;

    if (!driver.isPlayer && player) {
      if (driver.lap > player.lap) lapStatus = 'lapping';
      else if (driver.lap < player.lap) lapStatus = 'lapped';
    }

    const f2TimeStr =
      driver.f2Time > 0
        ? `+${driver.f2Time.toFixed(1)}`
        : driver.f2Time < 0
          ? driver.f2Time.toFixed(1)
          : '0.0';

    const f2Class = driver.isPlayer
      ? styles.f2Player
      : driver.f2Time > 0
        ? styles.f2Positive
        : driver.f2Time < 0
          ? styles.f2Negative
          : styles.f2Player;

    // Trend: closing = gap is shrinking (absolute f2Time decreasing)
    let trendIcon: React.ReactNode = null;

    if (!driver.isPlayer && Math.abs(trendDelta) > 0.00005) {
      // trendDelta < 0 = gap shrinking (closing), > 0 = gap growing (pulling away)
      trendIcon =
        trendDelta < 0 ? (
          <ChevronUp size={16} className={styles.trendUp} />
        ) : (
          <ChevronDown size={16} className={styles.trendDown} />
        );
    }

    const rowClass = [
      styles.driverRow,
      driver.isPlayer ? styles.driverRowPlayer : '',
      isPit ? styles.driverRowPit : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={rowClass}>
        <div
          className={styles.classStripe}
          style={{ backgroundColor: driver.carClassColor }}
        />

        <div className={styles.numberBlock}>
          <span className={styles.driverPosition}>{driver.position}</span>
          <span
            className={styles.driverCarNumber}
            style={{ color: driver.carClassColor }}
          >
            {driver.carNumber}
          </span>
        </div>

        <div className={styles.infoBlock}>
          <div className={styles.infoTop}>
            <span
              className={`${styles.driverName} ${driver.isPlayer ? styles.driverNamePlayer : ''}`}
            >
              {driver.userName.toUpperCase()}
            </span>

            {isPit && <span className={styles.pitTag}>Pit</span>}
          </div>

          <div className={styles.infoBottom}>
            <span
              className={styles.classLabel}
              style={{ color: driver.carClassColor }}
            >
              {driver.carClassShortName}
            </span>

            <span className={styles.metaSeparator}>|</span>
            <span className={styles.licInfo}>{driver.licString}</span>
            <span className={styles.irInfo}>
              {formatIRating(driver.iRating)}
            </span>

            {lapStatus && (
              <>
                <span className={styles.metaSeparator}>|</span>
                <span
                  className={
                    lapStatus === 'lapping'
                      ? styles.lapStatusLapping
                      : styles.lapStatusLapped
                  }
                >
                  {lapStatus === 'lapping' ? 'LAPPING' : 'LAPPED'}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.f2Block}>
          {trendIcon}
          <span className={`${styles.f2Time} ${f2Class}`}>
            {driver.isPlayer ? '-' : f2TimeStr}
          </span>
        </div>
      </div>
    );
  }
);

const LinearMap = observer(
  ({
    entries,
    player,
    position,
    isHorizontal,
  }: {
    entries: RelativeEntry[];
    player: RelativeEntry | null;
    position: string;
    isHorizontal: boolean;
  }) => {
    const borderClass =
      {
        top: styles.linearMapBorderTop,
        bottom: styles.linearMapBorderBottom,
        left: styles.linearMapBorderLeft,
        right: styles.linearMapBorderRight,
      }[position] ?? '';

    const sizeClass = isHorizontal
      ? styles.linearMapHorizontal
      : styles.linearMapVertical;

    return (
      <div className={`${styles.linearMap} ${sizeClass} ${borderClass}`}>
        <div
          className={`${styles.mapCenterLine} ${
            isHorizontal ? styles.mapCenterLineH : styles.mapCenterLineV
          }`}
        />

        {player &&
          entries.map((d) => {
            if (d.trackSurface !== TRACK_SURFACE_ON_TRACK && !d.isPlayer)
              return null;

            let diff = d.lapDistPct - player.lapDistPct;
            if (diff < -0.5) diff += 1;
            if (diff > 0.5) diff -= 1;

            const pct = diff * 100 + 50;
            const style: React.CSSProperties = {
              backgroundColor: d.carClassColor,
              transform: 'translate(-50%, -50%)',
            };

            if (isHorizontal) {
              style.left = `${pct}%`;
              style.top = '50%';
            } else {
              style.top = `${50 - diff * 100}%`;
              style.left = '50%';
            }

            return (
              <div
                key={d.carIdx}
                className={`${styles.mapDot} ${d.isPlayer ? styles.mapDotPlayer : ''}`}
                style={style}
              >
                <span className={styles.mapDotNumber}>{d.carNumber}</span>
              </div>
            );
          })}
      </div>
    );
  }
);

const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

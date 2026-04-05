import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { Driver } from '../../../types/bindings';

import styles from './RelativeWidget.module.scss';

interface RelativeEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
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

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const entries = useMemo((): RelativeEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    return drivers
      .filter((d) => {
        const idx = d.CarIdx;
        if (d.CarIsPaceCar === 1 || d.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        if (carIdx.car_idx_position[idx] <= 0) return false;
        return true;
      })
      .map((d): RelativeEntry => {
        const idx = d.CarIdx;

        return {
          carIdx: idx,
          userName: d.UserName,
          carNumber: d.CarNumber,
          carClass: d.CarClassShortName ?? 'Unknown',
          carClassShortName: d.CarClassShortName ?? '?',
          carClassColor: d.CarClassColor
            ? `#${d.CarClassColor.replace(/^0x/i, '')}`
            : '#888888',
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
      .sort((a, b) => b.f2Time - a.f2Time);
  }, [carIdx, drivers, playerCarIdx]);

  const player = entries.find((e) => e.isPlayer);
  const mapPos = settings.linearMapPosition;
  const isHorizontal = mapPos === 'top' || mapPos === 'bottom';
  const showMapFirst = mapPos === 'top' || mapPos === 'left';

  const containerClass = `${styles.relative} ${isHorizontal ? styles.relativeColumn : styles.relativeRow}`;

  return (
    <WidgetPanel className={containerClass} gap={0}>
      {settings.showLinearMap && showMapFirst && (
        <LinearMap
          entries={entries}
          player={player ?? null}
          position={mapPos}
          isHorizontal={isHorizontal}
        />
      )}

      <div className={styles.driverList}>
        {entries.map((entry) => (
          <DriverRow
            key={entry.carIdx}
            driver={entry}
            player={player ?? null}
          />
        ))}
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
  }: {
    driver: RelativeEntry;
    player: RelativeEntry | null;
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

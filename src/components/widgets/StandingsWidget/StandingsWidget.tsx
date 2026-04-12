import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives';
import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { pitStopsStore } from '../../../store/pit-stops.store';
import {
  parseClassColor,
  fallbackClassColor,
} from '../../../utils/class-color';
import { computeProjectedIrDelta } from '../../../utils/iracing-irating';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import type { Driver } from '../../../types/bindings';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { computeClassSof } from './standings-utils';
import { isSeparator } from './types';
import type { DriverEntry, DriverGroup, SeparatorEntry } from './types';

import styles from './StandingsWidget.module.scss';

export const StandingsWidget = observer(() => {
  const carIdx = telemetryStore.carIdx;
  const { sessionInfo, driverInfo, weekendInfo } = telemetryStore;
  const settings = widgetSettingsStore.getStandingsSettings();
  const { ref: tableWrapRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2, 5, 'tbody tr[data-driver-row]');

  const playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
  const drivers = useMemo(
    (): Driver[] => driverInfo?.Drivers ?? [],
    [driverInfo?.Drivers]
  );

  const startPositions = telemetryStore.startPositions;

  const driverEntries = useMemo((): DriverEntry[] => {
    if (!carIdx || drivers.length === 0) return [];

    const driverTires = driverInfo?.DriverTires ?? [];

    return drivers
      .filter((driver) => {
        const idx = driver.CarIdx;
        if (driver.CarIsPaceCar === 1 || driver.IsSpectator === 1) return false;
        if (idx >= carIdx.car_idx_position.length) return false;
        if (idx === playerCarIdx) return true;
        const pos = carIdx.car_idx_position[idx] ?? 0;
        const lapDistPct = carIdx.car_idx_lap_dist_pct[idx] ?? -1;
        if (pos > 0) return true;
        if (lapDistPct >= 0) return true;
        return false;
      })
      .map((driver): DriverEntry => {
        const idx = driver.CarIdx;
        return {
          carIdx: idx,
          userName: driver.UserName,
          carNumber: driver.CarNumber ?? '',
          carClassId: driver.CarClassID ?? -1,
          carClassShortName: driver.CarClassShortName ?? '',
          carClassColor: driver.CarClassColor
            ? parseClassColor(driver.CarClassColor)
            : fallbackClassColor(driver.CarClassID ?? -1),
          carScreenName: driver.CarScreenName ?? '',
          tireCompound: ((): string => {
            const tireIdx = carIdx.car_idx_tire_compound?.[idx] ?? -1;
            if (tireIdx < 0) return '';
            return (
              driverTires.find((t) => t.TireIndex === tireIdx)
                ?.TireCompoundType ?? ''
            );
          })(),
          position: carIdx.car_idx_position[idx] ?? 0,
          classPosition: carIdx.car_idx_class_position[idx] ?? 0,
          startPosOverall: startPositions.get(idx)?.overall ?? 0,
          startPosClass: startPositions.get(idx)?.class ?? 0,
          lap: carIdx.car_idx_lap?.[idx] ?? 0,
          lapDistPct: carIdx.car_idx_lap_dist_pct[idx] ?? 0,
          lastLapTime: carIdx.car_idx_last_lap_time?.[idx] ?? -1,
          bestLapTime: carIdx.car_idx_best_lap_time?.[idx] ?? -1,
          f2Time: carIdx.car_idx_f2_time?.[idx] ?? 0,
          trackSurface: carIdx.car_idx_track_surface?.[idx] ?? -1,
          iRating: driver.IRating ?? 0,
          licString: driver.LicString ?? 'R 0.00',
          licColor: driver.LicColor ?? '000000',
          incidents: driver.CurDriverIncidentCount ?? 0,
          isPlayer: idx === playerCarIdx,
          onPitRoad: carIdx.car_idx_on_pit_road[idx] ?? false,
        };
      })
      .sort((a, b) => {
        const posA = a.position > 0 ? a.position : a.startPosOverall || 999;
        const posB = b.position > 0 ? b.position : b.startPosOverall || 999;
        return posA - posB;
      });
  }, [carIdx, drivers, playerCarIdx, startPositions, driverInfo?.DriverTires]);

  const overallSof = useMemo(
    () => computeClassSof(driverEntries),
    [driverEntries]
  );

  const irDeltaMap = useMemo(() => {
    if (!settings.showIrChange) return new Map<number, number>();
    return computeProjectedIrDelta(
      driverEntries.map((d) => ({
        carIdx: d.carIdx,
        classId: d.carClassId,
        classPosition: d.classPosition,
        iRating: d.iRating,
      }))
    );
  }, [driverEntries, settings.showIrChange]);

  const displayGroups = useMemo((): DriverGroup[] => {
    if (driverEntries.length === 0) return [];

    const groupByClass =
      settings.groupByClass && settings.filterMode !== 'around-player';

    let groups: DriverGroup[];

    if (groupByClass) {
      const classMap = new Map<number, DriverEntry[]>();

      for (const d of driverEntries) {
        const existing = classMap.get(d.carClassId);
        if (existing) {
          existing.push(d);
        } else {
          classMap.set(d.carClassId, [d]);
        }
      }

      groups = Array.from(classMap.entries()).map(([, driversInClass]) => ({
        className: driversInClass[0]?.carClassShortName ?? 'Class',
        classShortName: driversInClass[0]?.carClassShortName ?? 'Class',
        classColor: driversInClass[0]?.carClassColor ?? '#888',
        totalDrivers: driversInClass.length,
        classSof: computeClassSof(driversInClass),
        drivers: driversInClass.sort(
          (a, b) => a.classPosition - b.classPosition
        ),
      }));
    } else {
      groups = [
        {
          className: 'Overall',
          classShortName: '',
          classColor: '',
          totalDrivers: driverEntries.length,
          classSof: overallSof,
          drivers: [...driverEntries],
        },
      ];
    }

    if (settings.filterMode === 'around-player') {
      const allDrivers = [...driverEntries];
      const playerIdx = allDrivers.findIndex((d) => d.isPlayer);

      if (playerIdx === -1) return [];

      const total = visibleRowCount;
      const half = Math.floor(total / 2);
      let start = Math.max(0, playerIdx - half);
      let end = Math.min(allDrivers.length, start + total);
      start = Math.max(0, end - total);

      return [
        {
          className: 'Overall',
          classShortName: '',
          classColor: '',
          totalDrivers: allDrivers.length,
          classSof: overallSof,
          drivers: allDrivers.slice(start, end),
        },
      ];
    }

    const totalBudget = visibleRowCount;
    const totalDrivers = groups.reduce(
      (sum, g) =>
        sum +
        (g.drivers.filter((d) => !isSeparator(d)) as DriverEntry[]).length,
      0
    );

    if (totalDrivers > totalBudget && groups.length > 0) {
      groups = groups.map((group) => {
        const driversOnly = group.drivers.filter(
          (d) => !isSeparator(d)
        ) as DriverEntry[];

        const share =
          groups.length === 1
            ? totalBudget
            : Math.max(
                1,
                Math.floor((driversOnly.length / totalDrivers) * totalBudget)
              );

        if (driversOnly.length <= share) return group;

        const playerIdx = driversOnly.findIndex((d) => d.isPlayer);
        const visible: (DriverEntry | SeparatorEntry)[] = driversOnly.slice(
          0,
          share
        );

        if (playerIdx >= share) {
          visible.push({ isSeparator: true, id: `sep-${group.className}` });
          visible.push(driversOnly[playerIdx]);
        }

        return { ...group, drivers: visible };
      });
    }

    return groups;
  }, [driverEntries, settings, overallSof, visibleRowCount]);

  const showGroupHeaders =
    settings.groupByClass && settings.filterMode !== 'around-player';

  return (
    <WidgetPanel className={styles.standings} gap={0}>
      {settings.showSessionHeader && (
        <SessionHeader
          settings={settings}
          sessionInfo={sessionInfo?.SessionInfo}
          weekendInfo={weekendInfo}
          driverEntries={driverEntries}
          overallSof={overallSof}
        />
      )}

      <div ref={tableWrapRef} className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colPos} />
            {settings.showPosChange && <col className={styles.colPosChange} />}
            <col className={styles.colNum} />
            <col className={styles.colName} />
            {settings.showBrand && <col className={styles.colBrand} />}
            {settings.showTire && <col className={styles.colTire} />}
            {!showGroupHeaders && <col className={styles.colClass} />}
            <col className={styles.colLic} />
            {settings.showIrChange && <col className={styles.colIrChange} />}
            <col className={styles.colInc} />
            {settings.showPitStops && <col className={styles.colStops} />}
            <col className={styles.colGap} />
            <col className={styles.colLap} />
            <col className={styles.colLap} />
          </colgroup>

          {settings.showColumnHeaders && (
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Pos</th>

                {settings.showPosChange && (
                  <th className={`${styles.th} ${styles.thCenter}`}>+/-</th>
                )}

                <th className={styles.th}>#</th>
                <th className={styles.th}>Driver</th>

                {settings.showBrand && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Brand</th>
                )}

                {settings.showTire && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Tire</th>
                )}

                {!showGroupHeaders && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Class</th>
                )}

                <th className={`${styles.th} ${styles.thCenter}`}>Lic / iR</th>

                {settings.showIrChange && (
                  <th
                    className={`${styles.th} ${styles.thCenter}`}
                    title="Projected iR change (Elo estimate, not real iRacing data)"
                  >
                    ΔiR*
                  </th>
                )}

                <th className={`${styles.th} ${styles.thCenter}`}>Inc</th>

                {settings.showPitStops && (
                  <th
                    className={`${styles.th} ${styles.thCenter}`}
                    title="Pit stops (player only — iRacing does not expose this per-driver)"
                  >
                    Stops
                  </th>
                )}

                <th className={`${styles.th} ${styles.thRight}`}>Gap</th>
                <th className={`${styles.th} ${styles.thRight}`}>Last</th>
                <th className={`${styles.th} ${styles.thRight}`}>Best</th>
              </tr>
            </thead>
          )}

          <tbody>
            {displayGroups.map((group) => (
              <ClassGroup
                key={group.className}
                group={group}
                showGroupHeader={showGroupHeaders}
                settings={settings}
                irDeltaMap={irDeltaMap}
                playerPitStops={pitStopsStore.playerStops}
              />
            ))}
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
});

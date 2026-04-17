import { useMemo } from 'react';

import { WidgetPanel } from '../primitives';
import { useVisibleRowCount } from '../../../hooks/useVisibleRowCount';
import type { SessionInfo, WeekendInfo } from '../../../types/bindings';
import type { StandingsWidgetSettings } from '../../../store/widget-settings.store';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { computeClassSof } from './standings-utils';
import { isSeparator } from './types';
import type { DriverEntry, DriverGroup, SeparatorEntry } from './types';

import styles from './StandingsWidget.module.scss';

interface StandingsWidgetProps {
  driverEntries: DriverEntry[];
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  playerPitStops: number;
  sessionInfo: SessionInfo | null;
  weekendInfo: WeekendInfo | null;
  overallSof: number;
}

export const StandingsWidget = ({
  driverEntries,
  settings,
  irDeltaMap,
  playerPitStops,
  sessionInfo,
  weekendInfo,
  overallSof,
}: StandingsWidgetProps) => {
  const { ref: tableWrapRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2, 5, 'tbody tr[data-driver-row]');

  const displayGroups = useMemo((): DriverGroup[] => {
    if (driverEntries.length === 0) return [];

    let groups: DriverGroup[];

    if (settings.groupByClass) {
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

    // Each group header occupies ~1 driver-row of height.
    // Subtract header rows from the budget so groups don't overflow.
    const headerRows = settings.groupByClass ? groups.length : 0;
    const totalBudget = Math.max(groups.length, visibleRowCount - headerRows);

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

  const showGroupHeaders = settings.groupByClass;

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
                playerPitStops={playerPitStops}
              />
            ))}
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
};

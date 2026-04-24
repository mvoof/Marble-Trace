import { useMemo, useState, useEffect } from 'react';

import { WidgetPanel } from '@/components/widgets/primitives';
import { useVisibleRowCount } from '@/hooks/useVisibleRowCount';
import type { SessionInfo, WeekendInfo } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { ClassSwitcher } from './ClassSwitcher/ClassSwitcher';
import { computeClassSof } from './standings-utils';
import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup, SeparatorEntry } from '@/types/standings';
import { isSeparator } from '@/components/widgets/widget-utils';

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

  const [activeClassIndex, setActiveClassIndex] = useState(0);

  const allClassGroups = useMemo((): DriverGroup[] => {
    if (driverEntries.length === 0) return [];

    const classMap = new Map<number, DriverEntry[]>();

    for (const d of driverEntries) {
      const existing = classMap.get(d.carClassId);
      if (existing) {
        existing.push(d);
      } else {
        classMap.set(d.carClassId, [d]);
      }
    }

    return Array.from(classMap.entries()).map(([classId, driversInClass]) => {
      const first = driversInClass[0];
      return {
        classId,
        className: first.carScreenNameShort,
        classShortName: first.carScreenNameShort,
        classColor: first.carClassColor,
        totalDrivers: driversInClass.length,
        classSof: computeClassSof(driversInClass),
        drivers: driversInClass.sort(
          (a, b) => a.classPosition - b.classPosition
        ),
      };
    });
  }, [driverEntries]);

  useEffect(() => {
    setActiveClassIndex((prev) =>
      allClassGroups.length === 0
        ? 0
        : Math.min(prev, allClassGroups.length - 1)
    );
  }, [allClassGroups.length]);

  const displayGroups = useMemo((): DriverGroup[] => {
    const sourceGroups = settings.enableClassCycling
      ? allClassGroups.length > 0
        ? [allClassGroups[activeClassIndex]]
        : []
      : [
          {
            classId: -1,
            className: 'Overall',
            classShortName: '',
            classColor: '',
            totalDrivers: driverEntries.length,
            classSof: overallSof,
            drivers: [...driverEntries],
          },
        ];

    if (sourceGroups.length === 0) return [];

    const totalBudget = Math.max(sourceGroups.length, visibleRowCount);

    const totalDrivers = sourceGroups.reduce(
      (sum, g) =>
        sum +
        (g.drivers.filter((d) => !isSeparator(d)) as DriverEntry[]).length,
      0
    );

    if (totalDrivers <= totalBudget) return sourceGroups;

    return sourceGroups.map((group) => {
      const driversOnly = group.drivers.filter(
        (d) => !isSeparator(d)
      ) as DriverEntry[];

      const share =
        sourceGroups.length === 1
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
        visible[share - 1] = driversOnly[playerIdx];
      }

      return { ...group, drivers: visible };
    });
  }, [
    allClassGroups,
    activeClassIndex,
    settings.enableClassCycling,
    driverEntries,
    overallSof,
    visibleRowCount,
  ]);

  const handlePrev = () =>
    setActiveClassIndex((prev) =>
      prev === 0 ? allClassGroups.length - 1 : prev - 1
    );

  const handleNext = () =>
    setActiveClassIndex((prev) =>
      prev === allClassGroups.length - 1 ? 0 : prev + 1
    );

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

      {settings.enableClassCycling && allClassGroups.length > 0 && (
        <ClassSwitcher
          groups={allClassGroups}
          activeIndex={activeClassIndex}
          onPrev={handlePrev}
          onNext={handleNext}
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
            {!settings.enableClassCycling && (
              <col className={styles.colClass} />
            )}

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

                {!settings.enableClassCycling && (
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
                key={group.classId}
                group={group}
                showGroupHeader={false}
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

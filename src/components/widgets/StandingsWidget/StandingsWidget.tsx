import { useMemo } from 'react';

import { WidgetPanel } from '@/components/widgets/primitives';
import { useVisibleRowCount } from '@/hooks/useVisibleRowCount';
import type { SessionInfo, WeekendInfo } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { ClassSwitcher } from './ClassSwitcher/ClassSwitcher';
import { computeClassSof } from './standings-utils';
import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types/standings';

import styles from './StandingsWidget.module.scss';

interface StandingsWidgetProps {
  driverEntries: DriverEntry[];
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  playerPitStops: number;
  sessionInfo: SessionInfo | null;
  weekendInfo: WeekendInfo | null;
  overallSof: number;
  activeClassIndex: number;
  dragMode: boolean;
  onPrevClass: () => void;
  onNextClass: () => void;
}

const sliceWithPlayerPin = (
  drivers: DriverEntry[],
  budget: number
): DriverEntry[] => {
  if (drivers.length <= budget) return drivers;

  const playerIdx = drivers.findIndex((d) => d.isPlayer);
  const visible = drivers.slice(0, budget);

  if (playerIdx >= budget) {
    visible[budget - 1] = drivers[playerIdx];
  }

  return visible;
};

export const StandingsWidget = ({
  driverEntries,
  settings,
  irDeltaMap,
  playerPitStops,
  sessionInfo,
  weekendInfo,
  overallSof,
  activeClassIndex,
  dragMode,
  onPrevClass,
  onNextClass,
}: StandingsWidgetProps) => {
  const { ref: tableWrapRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2, 5, 'tbody tr[data-driver-row]');

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

  const displayGroup = useMemo((): DriverGroup => {
    if (settings.enableClassCycling && allClassGroups.length > 0) {
      const group = allClassGroups[activeClassIndex];
      return {
        ...group,
        drivers: sliceWithPlayerPin(group.drivers, visibleRowCount),
      };
    }

    return {
      classId: -1,
      className: 'Overall',
      classShortName: '',
      classColor: '',
      totalDrivers: driverEntries.length,
      classSof: overallSof,
      drivers: sliceWithPlayerPin([...driverEntries], visibleRowCount),
    };
  }, [
    allClassGroups,
    activeClassIndex,
    settings.enableClassCycling,
    driverEntries,
    overallSof,
    visibleRowCount,
  ]);

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
          dragMode={dragMode}
          onPrev={onPrevClass}
          onNext={onNextClass}
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
            {!settings.enableClassCycling && settings.showClassBadge && (
              <col className={styles.colClass} />
            )}

            {settings.showIRatingBadge && <col className={styles.colLic} />}

            {settings.showIrChange && <col className={styles.colIrChange} />}

            <col className={styles.colInc} />

            {settings.showPitStops && <col className={styles.colStops} />}
            {settings.showLapsCompleted && (
              <col className={styles.colLapsCompleted} />
            )}

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

                <th className={styles.th}>Driver</th>
                <th className={styles.th}>#</th>

                {settings.showBrand && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Brand</th>
                )}

                {settings.showTire && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Tire</th>
                )}

                {!settings.enableClassCycling && settings.showClassBadge && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Class</th>
                )}

                {settings.showIRatingBadge && (
                  <th className={`${styles.th} ${styles.thCenter}`}>
                    Lic / iR
                  </th>
                )}

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

                {settings.showLapsCompleted && (
                  <th className={`${styles.th} ${styles.thCenter}`}>Laps</th>
                )}

                <th className={`${styles.th} ${styles.thRight}`}>Gap</th>
                <th className={`${styles.th} ${styles.thRight}`}>Last</th>
                <th className={`${styles.th} ${styles.thRight}`}>Best</th>
              </tr>
            </thead>
          )}

          <tbody>
            <ClassGroup
              group={displayGroup}
              settings={settings}
              irDeltaMap={irDeltaMap}
              playerPitStops={playerPitStops}
            />
          </tbody>
        </table>
      </div>
    </WidgetPanel>
  );
};

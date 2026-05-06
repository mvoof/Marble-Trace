import { useMemo } from 'react';

import { WidgetPanel } from '@/components/widgets/primitives';
import { useVisibleRowCount } from '@/hooks/useVisibleRowCount';
import type { SessionInfo, WeekendInfo } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { ClassSwitcher } from './ClassSwitcher/ClassSwitcher';
import { computeClassSof, buildGridTemplate } from './standings-utils';
import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types/standings';

import styles from './StandingsWidget.module.scss';

interface StartPosition {
  overall: number;
  class: number;
}

interface StandingsWidgetProps {
  driverEntries: DriverEntry[];
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  effectiveStartPosMap: Map<number, StartPosition>;
  playerPitStops: number;
  playerIncidents: number;
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
  if (budget <= 0) return [];
  if (drivers.length <= budget) return drivers;

  const playerIdx = drivers.findIndex((d) => d.isPlayer);
  const visible = drivers.slice(0, budget);

  if (playerIdx >= budget && budget >= 2) {
    visible[budget - 1] = drivers[playerIdx];
  }

  return visible;
};

export const StandingsWidget = ({
  driverEntries,
  settings,
  irDeltaMap,
  effectiveStartPosMap,
  playerPitStops,
  playerIncidents,
  sessionInfo,
  weekendInfo,
  overallSof,
  activeClassIndex,
  dragMode,
  onPrevClass,
  onNextClass,
}: StandingsWidgetProps) => {
  const { ref: listRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(2, 5, '[data-driver-row]');

  const gridTemplate = useMemo(() => buildGridTemplate(settings), [settings]);

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

    return Array.from(classMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([classId, driversInClass]) => {
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
      const clampedIndex = Math.max(
        0,
        Math.min(activeClassIndex, allClassGroups.length - 1)
      );
      const group = allClassGroups[clampedIndex];
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
          playerIncidents={playerIncidents}
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

      <div ref={listRef} className={styles.listWrap}>
        {settings.showColumnHeaders && (
          <div
            className={styles.headerRow}
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span className={styles.th}>Pos</span>
            <span className={styles.th}>#</span>
            <span className={styles.th}>Driver</span>

            {settings.showBrand && (
              <span className={`${styles.th} ${styles.thCenter}`}>Brand</span>
            )}

            {settings.showTire && (
              <span className={`${styles.th} ${styles.thCenter}`}>Tire</span>
            )}

            {!settings.enableClassCycling && settings.showClassBadge && (
              <span className={`${styles.th} ${styles.thCenter}`}>Class</span>
            )}

            {settings.showIRatingBadge && (
              <span className={`${styles.th} ${styles.thCenter}`}>
                Lic / iR
              </span>
            )}

            {settings.showIrChange && (
              <span
                className={`${styles.th} ${styles.thCenter}`}
                title="Projected iR change (Elo estimate, not real iRacing data)"
              >
                ΔiR*
              </span>
            )}

            {settings.showPitStops && (
              <span
                className={`${styles.th} ${styles.thCenter}`}
                title="Pit stops (player only — iRacing does not expose this per-driver)"
              >
                Stops
              </span>
            )}

            {settings.showLapsCompleted && (
              <span className={`${styles.th} ${styles.thCenter}`}>Laps</span>
            )}

            {settings.showPosChange && (
              <span className={`${styles.th} ${styles.thCenter}`}>+/-</span>
            )}

            <span className={`${styles.th} ${styles.thRight}`}>Gap</span>
            <span className={`${styles.th} ${styles.thRight}`}>Last</span>
            <span className={`${styles.th} ${styles.thRight}`}>Best</span>
          </div>
        )}

        <ClassGroup
          group={displayGroup}
          settings={settings}
          irDeltaMap={irDeltaMap}
          effectiveStartPosMap={effectiveStartPosMap}
          playerPitStops={playerPitStops}
          gridTemplate={gridTemplate}
        />
      </div>
    </WidgetPanel>
  );
};

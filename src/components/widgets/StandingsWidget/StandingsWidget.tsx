import { useMemo } from 'react';

import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/widgets/primitives/WidgetPanel/WidgetPanel';
import { useVisibleRowCount } from '@/hooks/useVisibleRowCount';
import type { SessionInfo, WeekendInfo } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';

import { SessionHeader } from './SessionHeader/SessionHeader';
import { ClassGroup } from './ClassGroup/ClassGroup';
import { ClassSwitcher } from './ClassSwitcher/ClassSwitcher';
import { buildGridTemplate } from './standings-utils';
import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types';
import { computedStore } from '@/store/iracing/computed.store';

import styles from './StandingsWidget.module.scss';

interface StandingsWidgetProps {
  driverEntries: DriverEntry[];
  settings: StandingsWidgetSettings;
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

export const StandingsWidget = observer(
  ({
    driverEntries,
    settings,
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
      useVisibleRowCount<HTMLDivElement>(
        settings.showColumnHeaders ? 1 : 0,
        5,
        '[data-driver-row]'
      );

    const gridTemplate = useMemo(() => buildGridTemplate(settings), [settings]);

    const allClassGroups = computedStore.allClassGroups;

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
            playerPitStops={playerPitStops}
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
              <span className={`${styles.th} ${styles.thCenter}`}>
                {settings.showBrand ? 'Br' : ''}
              </span>
              <span className={`${styles.th} ${styles.thCenter}`}>
                {settings.showTire ? 'T' : ''}
              </span>
              <span className={`${styles.th} ${styles.thCenter}`}>
                {!settings.enableClassCycling && settings.showClassBadge
                  ? 'Class'
                  : ''}
              </span>
              <span className={`${styles.th} ${styles.thCenter}`}>
                {settings.showIRatingBadge ? 'Lic/iR' : ''}
              </span>
              <span
                className={`${styles.th} ${styles.thCenter}`}
                title="Projected iR change (Elo estimate, not real iRacing data)"
              >
                {settings.showIrChange ? 'ΔiR' : ''}
              </span>
              <span className={`${styles.th} ${styles.thCenter}`}>
                {settings.showLapsCompleted ? 'Laps' : ''}
              </span>
              <span className={`${styles.th} ${styles.thCenter}`}>
                {settings.showPosChange ? '+/-' : ''}
              </span>
              <span className={`${styles.th} ${styles.thRight}`}>Gap</span>
              <span className={`${styles.th} ${styles.thRight}`}>Last</span>
              <span className={`${styles.th} ${styles.thRight}`}>Best</span>
            </div>
          )}

          <ClassGroup
            group={displayGroup}
            settings={settings}
            gridTemplate={gridTemplate}
          />
        </div>
      </WidgetPanel>
    );
  }
);

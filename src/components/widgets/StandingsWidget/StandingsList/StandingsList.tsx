import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { useVisibleRowCount } from '@/hooks/useVisibleRowCount';
import type { DriverEntry } from '@/types/bindings';
import type { DriverGroup } from '@/types';
import { computedStore } from '@/store/iracing/computed.store';
import { widgetSettingsStore } from '@/store/widget-settings.store';
import { computeClassSof } from '../standings-utils';
import { SessionHeader } from '../SessionHeader/SessionHeader';
import { ClassGroup } from '../ClassGroup/ClassGroup';
import { ClassSwitcher } from '../ClassSwitcher/ClassSwitcher';
import { buildGridTemplate } from '../standings-utils';

import styles from './StandingsList.module.scss';

const sliceWithPlayerPin = (
  drivers: DriverEntry[],
  budget: number
): DriverEntry[] => {
  if (budget <= 0) {
    return [];
  }

  if (drivers.length <= budget) {
    return drivers;
  }

  const playerIdx = drivers.findIndex((driver) => driver.isPlayer);
  const visible = drivers.slice(0, budget);

  if (playerIdx >= budget && budget >= 2) {
    visible[budget - 1] = drivers[playerIdx];
  }

  return visible;
};

export const StandingsList = observer(() => {
  const settings = widgetSettingsStore.getStandingsSettings();
  const driverEntries = computedStore.standings?.entries ?? [];
  const allClassGroups = computedStore.allClassGroups;
  const activeClassIndex = widgetSettingsStore.standingsActiveClassIndex;
  const overallSof = computeClassSof(driverEntries);

  const { ref: listRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      settings.showColumnHeaders ? 1 : 0,
      5,
      '[data-driver-row]'
    );

  const gridTemplate = useMemo(() => buildGridTemplate(settings), [settings]);

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
      {settings.showSessionHeader && <SessionHeader />}

      {settings.enableClassCycling && allClassGroups.length > 0 && (
        <ClassSwitcher />
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
              <span className={`${styles.th} ${styles.thCenter}`}>Lic/iR</span>
            )}
            {settings.showIrChange && (
              <span
                className={`${styles.th} ${styles.thCenter}`}
                title="Projected iR change (Elo estimate, not real iRacing data)"
              >
                ΔiR
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

        <ClassGroup group={displayGroup} />
      </div>
    </WidgetPanel>
  );
});

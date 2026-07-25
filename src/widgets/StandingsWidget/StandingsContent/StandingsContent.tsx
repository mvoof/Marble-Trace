import { useCallback } from 'react';
import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import type { DriverEntry } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useBackendComputedStore,
  useSimStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  buildVisibleRows,
  computeClassSof,
} from '@utils/widget/standings-utils';
import { useVisibleRowCount } from '@/hooks/common/useVisibleRowCount';
import { useRowMoveAnimation } from '@/hooks/common/useRowMoveAnimation';
import { NoDataPlaceholder } from '@/components/shared/NoDataPlaceholder/NoDataPlaceholder';
import { SessionHeader } from '@widgets/StandingsWidget/SessionHeader/SessionHeader';
import { ClassGroup } from '@widgets/StandingsWidget/ClassGroup/ClassGroup';
import { ClassSwitcher } from '@widgets/StandingsWidget/ClassSwitcher/ClassSwitcher';
import { StandingsHeader } from '@widgets/StandingsWidget/StandingsHeader/StandingsHeader';
import { SessionFooter } from '@widgets/StandingsWidget/SessionFooter/SessionFooter';

import styles from './StandingsContent.module.scss';

export const StandingsContent = observer(() => {
  const { standings } = useBackendComputedStore();
  const sim = useSimStore();
  const widgetSettings = useWidgetSettingsStore();
  const standingsWidget = useStandingsWidgetStore();
  const { allClassGroups } = standingsWidget;

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const driverEntries = standingsWidget.orderedEntries;

  const activeClassIndex = standingsWidget.activeClassIndex;
  const overallSof = computeClassSof(driverEntries);

  const isGrouped =
    settings.viewMode === 'grouped' && allClassGroups.length > 0;

  const animateRows = useRowMoveAnimation<HTMLDivElement>();

  const { ref: measureRows, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      settings.rowPadding === 'wide'
        ? 3.5
        : settings.rowPadding === 'medium'
          ? 3.25
          : 2.75,
      5,
      '[data-driver-row]'
    );

  // Both hooks hand back a state setter, so the merged callback must stay stable
  // — a fresh identity would detach and re-attach the node on every render.
  const attachList = useCallback(
    (node: HTMLDivElement | null) => {
      measureRows(node);
      animateRows(node);
    },
    [measureRows, animateRows]
  );

  const rowsPerGroupedClass = (() => {
    if (!isGrouped || allClassGroups.length === 0) {
      return 0;
    }

    if (settings.groupedRowsPerClass > 0) {
      return settings.groupedRowsPerClass;
    }

    const classHeaderRows = allClassGroups.length;
    const rowsLeftForDrivers = Math.max(1, visibleRowCount - classHeaderRows);

    return Math.max(1, Math.floor(rowsLeftForDrivers / allClassGroups.length));
  })();

  const visibleRows = (drivers: DriverEntry[], maxRows: number) =>
    buildVisibleRows(
      drivers,
      maxRows,
      settings.driversAhead,
      settings.driversBehind
    );

  const displayGroup = (): DriverGroup => {
    if (settings.viewMode === 'cycling' && allClassGroups.length > 0) {
      const clampedIndex = Math.max(
        0,
        Math.min(activeClassIndex, allClassGroups.length - 1)
      );

      const group = allClassGroups[clampedIndex];

      return { ...group, ...visibleRows(group.drivers, visibleRowCount) };
    }

    return {
      classId: -1,
      className: 'Overall',
      classShortName: '',
      classColor: '',
      totalDrivers: driverEntries.length,
      classSof: overallSof,
      ...visibleRows(driverEntries, visibleRowCount),
    };
  };

  const hasData =
    sim.isConnected && standings != null && standings.entries.length > 0;

  return (
    <>
      <SessionHeader />

      {!hasData ? (
        <NoDataPlaceholder />
      ) : (
        <>
          <ClassSwitcher />

          <div ref={attachList} className={styles.listWrap}>
            <StandingsHeader />

            {isGrouped ? (
              allClassGroups.map((group) => (
                <ClassGroup
                  key={group.classId}
                  group={{
                    ...group,
                    ...visibleRows(group.drivers, rowsPerGroupedClass),
                  }}
                  showHeader
                />
              ))
            ) : (
              <ClassGroup group={displayGroup()} />
            )}
          </div>

          <SessionFooter />
        </>
      )}
    </>
  );
});

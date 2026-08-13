import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent,
  type WheelEvent,
} from 'react';
import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import type { DriverEntry } from '@/types/bindings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useAppSettingsStore,
  useBackendComputedStore,
  useSimStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { buildVisibleRows } from '@ui/widgets/StandingsWidget/standings-utils';
import { computeClassSof } from '@utils/driver';
import { SINGLE_LIST_SCROLL_KEY } from '@store/widgets/standings.widget';
import type { ScrollMetrics } from '@utils/canvas';
import { ScrollIndicator } from '@ui/shared/ScrollIndicator/ScrollIndicator';
import { useVisibleRowCount } from '@ui/hooks/useVisibleRowCount';
import {
  useRowMoveAnimation,
  ROW_KEY_ATTRIBUTE,
} from '@ui/hooks/useRowMoveAnimation';
import { NoDataPlaceholder } from '@ui/shared/NoDataPlaceholder/NoDataPlaceholder';
import { SessionHeader } from '@ui/widgets/StandingsWidget/SessionHeader/SessionHeader';
import { ClassGroup } from '@ui/widgets/StandingsWidget/ClassGroup/ClassGroup';
import { CLASS_HEADER_ATTRIBUTE } from '@ui/widgets/StandingsWidget/ClassGroupHeader/ClassGroupHeader';
import { ClassSwitcher } from '@ui/widgets/StandingsWidget/ClassSwitcher/ClassSwitcher';
import { StandingsHeader } from '@ui/widgets/StandingsWidget/StandingsHeader/StandingsHeader';
import { SessionFooter } from '@ui/widgets/StandingsWidget/SessionFooter/SessionFooter';

import styles from './StandingsContent.module.scss';

// One wheel notch moves a small block of rows — matching a text editor's feel
// rather than crawling a single row at a time.
const WHEEL_STEP_ROWS = 3;

export const StandingsContent = observer(() => {
  const { standings } = useBackendComputedStore();
  const sim = useSimStore();
  const widgetSettings = useWidgetSettingsStore();
  const standingsWidget = useStandingsWidgetStore();
  const appSettings = useAppSettingsStore();
  const { allClassGroups } = standingsWidget;

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const driverEntries = standingsWidget.orderedEntries;

  const activeClassIndex = standingsWidget.activeClassIndex;
  const overallSof = computeClassSof(driverEntries);

  const isGrouped =
    settings.viewMode === 'grouped' && allClassGroups.length > 0;

  // While the table is scrolled the rows shift because the window moved, not
  // because anyone passed anyone — sliding them would just smear the scroll.
  const animateRows = useRowMoveAnimation<HTMLDivElement>(
    !standingsWidget.isScrolled
  );

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

  // Classes below the widget height are cut off, so the drawn set starts at the
  // class the scroll has raised to the top.
  const drawnClassGroups = isGrouped
    ? allClassGroups.slice(standingsWidget.groupScrollIndex)
    : allClassGroups;

  const rowsPerGroupedClass = (() => {
    if (!isGrouped || drawnClassGroups.length === 0) {
      return 0;
    }

    if (settings.groupedRowsPerClass > 0) {
      return settings.groupedRowsPerClass;
    }

    const classHeaderRows = drawnClassGroups.length;
    const rowsLeftForDrivers = Math.max(1, visibleRowCount - classHeaderRows);

    return Math.max(
      1,
      Math.floor(rowsLeftForDrivers / drawnClassGroups.length)
    );
  })();

  const clampedClassIndex = Math.min(
    activeClassIndex,
    Math.max(0, allClassGroups.length - 1)
  );

  const singleListDrivers =
    settings.viewMode === 'cycling' && allClassGroups.length > 0
      ? (allClassGroups[clampedClassIndex]?.drivers ?? [])
      : driverEntries;

  // Grouped view draws every class as its own list, so each one gets its own limit.
  const scrollBounds: Map<number, ScrollMetrics> = isGrouped
    ? new Map(
        drawnClassGroups.map((group) => [
          group.classId,
          { total: group.drivers.length, windowSize: rowsPerGroupedClass },
        ])
      )
    : new Map([
        [
          SINGLE_LIST_SCROLL_KEY,
          {
            total: singleListDrivers.length,
            windowSize: visibleRowCount,
          },
        ],
      ]);

  // How many classes the widget height actually shows, each one costing its
  // header plus the driver rows under it — the travel the outer bar reports.
  const visibleClassCount = isGrouped
    ? Math.max(1, Math.floor(visibleRowCount / (rowsPerGroupedClass + 1)))
    : 0;

  // A fresh Map every render would re-run the effect forever, so the limits are
  // compared by value. Published from an effect rather than during render because
  // clamping an offset writes to the store, which must not happen while rendering.
  const boundsSignature = Array.from(scrollBounds)
    .map(([key, metrics]) => `${key}:${metrics.total}/${metrics.windowSize}`)
    .join();

  const singleListOffset = standingsWidget.scrollOffsetFor(
    SINGLE_LIST_SCROLL_KEY
  );

  const groupKeys = allClassGroups.map((group) => group.classId);
  const groupKeysSignature = groupKeys.join();

  const latestBounds = useRef(scrollBounds);
  latestBounds.current = scrollBounds;

  const latestGroupKeys = useRef(groupKeys);
  latestGroupKeys.current = groupKeys;

  const latestClassCount = useRef(visibleClassCount);
  latestClassCount.current = visibleClassCount;

  useEffect(() => {
    standingsWidget.setScrollBounds(
      latestBounds.current,
      latestGroupKeys.current,
      latestClassCount.current
    );
  }, [standingsWidget, boundsSignature, groupKeysSignature, visibleClassCount]);

  const visibleRows = (
    drivers: DriverEntry[],
    maxRows: number,
    scrollOffset = 0
  ) =>
    buildVisibleRows(
      drivers,
      maxRows,
      settings.driversAhead,
      settings.driversBehind,
      scrollOffset
    );

  /**
   * What the wheel would move from where it is pointed: a driver row scrolls its own
   * class, a class header moves the classes themselves. The rows already carry their
   * car index, so the class comes from the driver map — no extra markup needed.
   */
  const scrollTargetAt = (
    target: EventTarget
  ): { classId: number | null; onClassHeader: boolean } => {
    const none = { classId: null, onClassHeader: false };

    if (!isGrouped || !(target instanceof Element)) {
      return none;
    }

    if (target.closest(`[${CLASS_HEADER_ATTRIBUTE}]`)) {
      return { classId: null, onClassHeader: true };
    }

    const row = target.closest(`[${ROW_KEY_ATTRIBUTE}]`);
    const carIdx = Number(row?.getAttribute(ROW_KEY_ATTRIBUTE));

    if (!row || Number.isNaN(carIdx)) {
      return none;
    }

    return {
      classId: standingsWidget.driverMap.get(carIdx)?.carClassId ?? null,
      onClassHeader: false,
    };
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const delta = Math.sign(event.deltaY) * WHEEL_STEP_ROWS;
    const { classId, onClassHeader } = scrollTargetAt(event.target);

    if (onClassHeader) {
      standingsWidget.scrollClasses(delta);

      return;
    }

    standingsWidget.scrollByRows(delta, classId ?? undefined);
  };

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    const { classId, onClassHeader } = scrollTargetAt(event.target);

    standingsWidget.setScrollHover(classId, onClassHeader);
  };

  const handleMouseLeave = () => {
    standingsWidget.setScrollHover(null);
  };

  const displayGroup = (): DriverGroup => {
    if (settings.viewMode === 'cycling' && allClassGroups.length > 0) {
      const clampedIndex = Math.max(
        0,
        Math.min(activeClassIndex, allClassGroups.length - 1)
      );

      const group = allClassGroups[clampedIndex];

      return {
        ...group,
        ...visibleRows(group.drivers, visibleRowCount, singleListOffset),
      };
    }

    return {
      classId: -1,
      className: 'Overall',
      classShortName: '',
      classColor: '',
      totalDrivers: driverEntries.length,
      classSof: overallSof,
      ...visibleRows(driverEntries, visibleRowCount, singleListOffset),
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

          <div
            ref={attachList}
            className={styles.listWrap}
            onWheel={handleWheel}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <StandingsHeader />

            {isGrouped ? (
              drawnClassGroups.map((group) => (
                <ClassGroup
                  key={group.classId}
                  group={{
                    ...group,
                    ...visibleRows(
                      group.drivers,
                      rowsPerGroupedClass,
                      standingsWidget.scrollOffsetFor(group.classId)
                    ),
                  }}
                  showHeader
                  showScrollbar
                />
              ))
            ) : (
              <ClassGroup group={displayGroup()} />
            )}

            {/* Grouped view: the outer bar tracks the classes themselves, the
                inset ones inside each group track that class's drivers. */}
            <ScrollIndicator
              thumb={
                isGrouped
                  ? standingsWidget.groupThumb
                  : standingsWidget.listThumb(SINGLE_LIST_SCROLL_KEY)
              }
              visible={appSettings.interactMode || standingsWidget.isScrolled}
            />
          </div>

          <SessionFooter />
        </>
      )}
    </>
  );
});

import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useBackendComputedStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  computeClassSof,
  sliceWithPlayerPin,
} from '@utils/widget/standings-utils';
import { useVisibleRowCount } from '@/hooks/common/useVisibleRowCount';
import { SessionHeader } from '@widgets/StandingsWidget/SessionHeader/SessionHeader';
import { ClassGroup } from '@widgets/StandingsWidget/ClassGroup/ClassGroup';
import { ClassSwitcher } from '@widgets/StandingsWidget/ClassSwitcher/ClassSwitcher';
import { StandingsHeader } from '@widgets/StandingsWidget/StandingsHeader/StandingsHeader';
import { SessionFooter } from '@widgets/StandingsWidget/SessionFooter/SessionFooter';

import styles from './StandingsContent.module.scss';

export const StandingsContent = observer(() => {
  const { standings } = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const standingsWidget = useStandingsWidgetStore();
  const { allClassGroups } = standingsWidget;

  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  const driverEntries = standings?.entries ?? [];

  const activeClassIndex = standingsWidget.activeClassIndex;
  const overallSof = computeClassSof(driverEntries);

  const isGrouped =
    settings.viewMode === 'grouped' && allClassGroups.length > 0;

  const { ref: listRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      settings.showColumnHeaders ? 1 : 0,
      5,
      '[data-driver-row]'
    );

  const rowsPerGroupedClass = (() => {
    if (!isGrouped || allClassGroups.length === 0) {
      return 0;
    }

    const classHeaderRows = allClassGroups.length;
    const available = Math.max(1, visibleRowCount - classHeaderRows);

    return Math.max(1, Math.floor(available / allClassGroups.length));
  })();

  const displayGroup = (): DriverGroup => {
    if (settings.viewMode === 'cycling' && allClassGroups.length > 0) {
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
  };

  return (
    <>
      <SessionHeader />

      <ClassSwitcher />

      <div ref={listRef} className={styles.listWrap}>
        <StandingsHeader />

        {isGrouped ? (
          allClassGroups.map((group) => (
            <ClassGroup
              key={group.classId}
              group={{
                ...group,
                drivers: sliceWithPlayerPin(group.drivers, rowsPerGroupedClass),
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
  );
});

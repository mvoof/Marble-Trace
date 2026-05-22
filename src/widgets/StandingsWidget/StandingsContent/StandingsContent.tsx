import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  useBackendComputedStore,
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

import styles from './StandingsContent.module.scss';

export const StandingsContent = observer(() => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');
  const allClassGroups = computed.allClassGroups;
  const driverEntries = computed.standings?.entries ?? [];
  const activeClassIndex = widgetSettings.standingsActiveClassIndex;
  const overallSof = computeClassSof(driverEntries);

  const { ref: listRef, count: visibleRowCount } =
    useVisibleRowCount<HTMLDivElement>(
      settings.showColumnHeaders ? 1 : 0,
      5,
      '[data-driver-row]'
    );

  const displayGroup = (): DriverGroup => {
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
  };

  return (
    <>
      <SessionHeader />

      <ClassSwitcher />

      <div ref={listRef} className={styles.listWrap}>
        <StandingsHeader />

        <ClassGroup group={displayGroup()} />
      </div>
    </>
  );
});

import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import { ClassGroupHeader } from '@widgets/StandingsWidget/ClassGroupHeader/ClassGroupHeader';
import { DriverRow } from '@widgets/StandingsWidget/DriverRow/DriverRow';
import { ScrollIndicator } from '@/components/shared/ScrollIndicator/ScrollIndicator';
import {
  useAppSettingsStore,
  useStandingsWidgetStore,
} from '@store/root-store-context';

import styles from './ClassGroup.module.scss';

interface ClassGroupProps {
  group: DriverGroup;
  showHeader?: boolean;
  /** Grouped view: this class scrolls on its own, so it carries its own bar. */
  showScrollbar?: boolean;
}

export const ClassGroup = observer(
  ({ group, showHeader = false, showScrollbar = false }: ClassGroupProps) => {
    const standingsWidget = useStandingsWidgetStore();
    const appSettings = useAppSettingsStore();
    // Every header lights up while the cursor is on one of them: the wheel moves the
    // classes, not the drivers of any single class.
    const isScrollTarget =
      standingsWidget.isClassScrollHovered ||
      standingsWidget.hoveredClassId === group.classId;

    return (
      <div className={styles.group}>
        {showHeader && (
          <ClassGroupHeader
            className={group.className}
            classShortName={group.classShortName}
            classColor={group.classColor}
            classSof={group.classSof}
            totalDrivers={group.totalDrivers}
            isScrollTarget={isScrollTarget}
          />
        )}

        {group.drivers.map((driver, index) => (
          <DriverRow
            key={driver.carIdx}
            carIdx={driver.carIdx}
            index={index}
            startsPlayerWindow={index === group.windowStartIndex}
          />
        ))}

        {showScrollbar && (
          <ScrollIndicator
            thumb={standingsWidget.listThumb(group.classId)}
            visible={
              appSettings.interactMode ||
              standingsWidget.scrollOffsetFor(group.classId) > 0
            }
            inset
          />
        )}
      </div>
    );
  }
);

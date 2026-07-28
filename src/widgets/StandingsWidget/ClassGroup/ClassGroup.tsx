import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import { ClassGroupHeader } from '@widgets/StandingsWidget/ClassGroupHeader/ClassGroupHeader';
import { DriverRow } from '@widgets/StandingsWidget/DriverRow/DriverRow';
import { useStandingsWidgetStore } from '@store/root-store-context';

interface ClassGroupProps {
  group: DriverGroup;
  showHeader?: boolean;
}

export const ClassGroup = observer(
  ({ group, showHeader = false }: ClassGroupProps) => {
    const standingsWidget = useStandingsWidgetStore();
    // Every header lights up while the cursor is on one of them: the wheel moves the
    // classes, not the drivers of any single class.
    const isScrollTarget =
      standingsWidget.isClassScrollHovered ||
      standingsWidget.hoveredClassId === group.classId;

    return (
      <>
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
      </>
    );
  }
);

import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import { ClassGroupHeader } from '@widgets/StandingsWidget/ClassGroupHeader/ClassGroupHeader';
import { DriverRow } from '@widgets/StandingsWidget/DriverRow/DriverRow';

interface ClassGroupProps {
  group: DriverGroup;
  showHeader?: boolean;
}

export const ClassGroup = observer(
  ({ group, showHeader = false }: ClassGroupProps) => (
    <>
      {showHeader && (
        <ClassGroupHeader
          className={group.className}
          classShortName={group.classShortName}
          classColor={group.classColor}
          classSof={group.classSof}
          totalDrivers={group.totalDrivers}
        />
      )}

      {group.drivers.map((driver, index) => (
        <DriverRow key={driver.carIdx} carIdx={driver.carIdx} index={index} />
      ))}
    </>
  )
);

import { observer } from 'mobx-react-lite';

import type { DriverGroup } from '@/types';
import { DriverRow } from '../DriverRow/DriverRow';

interface ClassGroupProps {
  group: DriverGroup;
}

export const ClassGroup = observer(({ group }: ClassGroupProps) => (
  <>
    {group.drivers.map((driver) => (
      <DriverRow key={driver.carIdx} carIdx={driver.carIdx} />
    ))}
  </>
));

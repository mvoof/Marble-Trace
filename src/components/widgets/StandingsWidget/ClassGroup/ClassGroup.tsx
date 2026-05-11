import type { DriverGroup } from '@/types';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { DriverRow } from '../DriverRow/DriverRow';

interface ClassGroupProps {
  group: DriverGroup;
  settings: StandingsWidgetSettings;
  gridTemplate: string;
}

export const ClassGroup = ({
  group,
  settings,
  gridTemplate,
}: ClassGroupProps) => (
  <>
    {group.drivers.map((driver) => (
      <DriverRow
        key={driver.carIdx}
        carIdx={driver.carIdx}
        settings={settings}
        gridTemplate={gridTemplate}
      />
    ))}
  </>
);

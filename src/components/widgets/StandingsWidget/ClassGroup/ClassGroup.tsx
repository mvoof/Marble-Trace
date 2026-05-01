import type { DriverGroup } from '@/types/standings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { DriverRow } from '../DriverRow/DriverRow';

interface ClassGroupProps {
  group: DriverGroup;
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  playerPitStops: number;
}

export const ClassGroup = ({
  group,
  settings,
  irDeltaMap,
  playerPitStops,
}: ClassGroupProps) => (
  <>
    {group.drivers.map((driver) => (
      <DriverRow
        key={driver.carIdx}
        driver={driver}
        settings={settings}
        irDelta={irDeltaMap.get(driver.carIdx)}
        playerPitStops={playerPitStops}
      />
    ))}
  </>
);

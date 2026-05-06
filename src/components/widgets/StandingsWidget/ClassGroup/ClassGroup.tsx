import type { DriverGroup } from '@/types/standings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { DriverRow } from '../DriverRow/DriverRow';

interface StartPosition {
  overall: number;
  class: number;
}

interface ClassGroupProps {
  group: DriverGroup;
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  effectiveStartPosMap: Map<number, StartPosition>;
  playerPitStops: number;
  gridTemplate: string;
}

export const ClassGroup = ({
  group,
  settings,
  irDeltaMap,
  effectiveStartPosMap,
  playerPitStops,
  gridTemplate,
}: ClassGroupProps) => (
  <>
    {group.drivers.map((driver) => (
      <DriverRow
        key={driver.carIdx}
        driver={driver}
        settings={settings}
        irDelta={irDeltaMap.get(driver.carIdx)}
        effectiveStartPos={effectiveStartPosMap.get(driver.carIdx)}
        playerPitStops={playerPitStops}
        gridTemplate={gridTemplate}
      />
    ))}
  </>
);

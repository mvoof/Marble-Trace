import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { TrackMapWidgetSettings } from '@/types/widget-settings';
import { useIncidentsWidgetStore } from '@store/root-store-context';

import { FlagZoneStripes } from './FlagZoneStripes';

interface FlagZonesProps {
  svgPath: string;
  pathLength: number;
  strokeWidth: number;
}

/**
 * The incident layer of the track map. Kept out of `TrackMapSvg` so the map's
 * per-frame car rendering never re-runs the zone geometry, and so it reads its
 * own settings instead of arriving as three more props.
 */
export const FlagZones = observer(
  ({ svgPath, pathLength, strokeWidth }: FlagZonesProps) => {
    const incidentsStore = useIncidentsWidgetStore();

    const settings = useWidgetSettings<TrackMapWidgetSettings>('track-map');

    if (!(settings.showIncidentZones ?? true)) {
      return null;
    }

    return (
      <FlagZoneStripes
        zones={incidentsStore.zones}
        svgPath={svgPath}
        pathLength={pathLength}
        strokeWidth={strokeWidth}
        blink={settings.blinkIncidentZones ?? true}
        zoneStyle={settings.flagZoneStyle ?? 'filled'}
      />
    );
  }
);

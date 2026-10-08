import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { useIncidentsWidgetStore } from '@entities/incidents/incidents-context';

import { FlagZoneStripes } from './FlagZoneStripes';
import type { TrackMapWidgetSettings } from '../../settings-schema';

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

    if (!settings.showIncidentZones) {
      return null;
    }

    return (
      <FlagZoneStripes
        zones={incidentsStore.zones}
        svgPath={svgPath}
        pathLength={pathLength}
        strokeWidth={strokeWidth}
        blink={settings.blinkIncidentZones}
        zoneStyle={settings.flagZoneStyle}
      />
    );
  }
);

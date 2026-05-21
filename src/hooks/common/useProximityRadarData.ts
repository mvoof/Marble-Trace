import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { useRadarVisibility } from './useRadarVisibility';
import { useWidgetAutoHide } from './useWidgetAutoHide';

export const useProximityRadarData = (
  widgetId: 'proximity-radar' | 'radar-bar',
  searchRadius: number
) => {
  const proximity = computedStore.proximity;
  const radarSettings = widgetSettingsStore.getRadarSettings(widgetId);

  const nearbyCars =
    proximity?.nearbyCars.filter((car) => car.clearance <= searchRadius) ?? [];

  const spotterLeft = proximity?.spotterLeft ?? false;
  const spotterRight = proximity?.spotterRight ?? false;

  const visible = useRadarVisibility(
    nearbyCars,
    radarSettings,
    spotterLeft || spotterRight
  );

  useWidgetAutoHide(visible);

  return {
    proximity,
    radarSettings,
    nearbyCars,
    spotterLeft,
    spotterRight,
    visible,
  };
};

import { useRadarVisibility } from './useRadarVisibility';
import { useWidgetAutoHide } from './useWidgetAutoHide';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const useProximityRadarData = (
  widgetId: 'proximity-radar' | 'radar-bar',
  searchRadius: number
) => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const proximity = computed.proximity;
  const radarSettings = widgetSettings.getRadarSettings(widgetId);

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

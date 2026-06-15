import type { RadarSettings } from '@/types/widget-settings';
import { useWidgetAutoHide } from './useWidgetAutoHide';
import {
  useBackendComputedStore,
  useRadarWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const useProximityRadarData = (
  widgetId: 'proximity-radar' | 'radar-bar',
  searchRadius: number
) => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const radarStore = useRadarWidgetStore();

  const proximity = computed.proximity;
  const radarSettings = widgetSettings.getSettings<RadarSettings>(widgetId);

  const nearbyCars =
    proximity?.nearbyCars.filter((car) => car.clearance <= searchRadius) ?? [];

  const spotterLeft = proximity?.spotterLeft ?? false;
  const spotterRight = proximity?.spotterRight ?? false;

  const visible = radarStore.isVisible;

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

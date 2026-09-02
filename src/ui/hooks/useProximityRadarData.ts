import type { RadarSettings } from '@/types/widget-settings';
import { useWidgetAutoHide } from './useWidgetAutoHide';
import {
  useBackendComputedStore,
  useRadarWidgetStore,
} from '@store/root-store-context';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';

export const useProximityRadarData = (
  widgetId: 'proximity-radar' | 'radar-bar',
  searchRadius: number
) => {
  const computed = useBackendComputedStore();
  const radarStore = useRadarWidgetStore();

  const proximity = computed.proximity;
  // `widgetId` is the widget *type* the caller is; the copy actually being
  // rendered comes from the mount context, so two radars on two screens keep
  // their own range and their own colors.
  const radarSettings = useWidgetSettings<RadarSettings>(widgetId);

  const nearbyCars =
    proximity?.nearbyCars.filter((car) => car.clearance <= searchRadius) ?? [];

  const spotterLeft = proximity?.spotterLeft ?? false;
  const spotterRight = proximity?.spotterRight ?? false;

  const visible = radarStore.isVisibleForWidget(widgetId);

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

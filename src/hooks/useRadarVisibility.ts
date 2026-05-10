import { useEffect, useMemo, useReducer } from 'react';
import type { NearbyCar } from '../types/bindings';
import type { RadarSettings } from '../types/widget-settings';
import { appSettingsStore } from '../store/app-settings.store';

type VisibilityAction = 'SHOW' | 'HIDE';

const visibilityReducer = (
  state: boolean,
  action: VisibilityAction
): boolean => {
  switch (action) {
    case 'SHOW':
      return true;
    case 'HIDE':
      return false;
    default:
      return state;
  }
};

export const useRadarVisibility = (
  nearbyCars: NearbyCar[],
  settings: RadarSettings,
  hasSpotterContact: boolean = false
): boolean => {
  const [visible, dispatch] = useReducer(visibilityReducer, false);

  const { visibilityMode, proximityThreshold, hideDelay } = settings;
  const { dragMode } = appSettingsStore;

  const hasNearby = useMemo(
    () =>
      hasSpotterContact ||
      nearbyCars.some((car) => car.clearance <= proximityThreshold),
    [nearbyCars, proximityThreshold, hasSpotterContact]
  );

  useEffect(() => {
    if (visibilityMode === 'always') {
      dispatch('SHOW');

      return;
    }

    if (hasNearby) {
      dispatch('SHOW');
    } else {
      const timeoutId = setTimeout(() => {
        dispatch('HIDE');
      }, hideDelay * 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [hasNearby, visibilityMode, hideDelay]);

  return visibilityMode === 'always' || dragMode ? true : visible;
};

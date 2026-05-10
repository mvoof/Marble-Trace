import { useState, useEffect, useMemo } from 'react';
import type { NearbyCar } from '../types/bindings';
import type { RadarSettings } from '../types/widget-settings';
import { appSettingsStore } from '../store/app-settings.store';

export const useRadarVisibility = (
  nearbyCars: NearbyCar[],
  settings: RadarSettings,
  hasSpotterContact: boolean = false
): boolean => {
  const [visible, setVisible] = useState(false);

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
      setVisible(true);

      return;
    }

    if (hasNearby) {
      setVisible(true);
    } else if (visible) {
      const timeoutId = setTimeout(() => {
        setVisible(false);
      }, hideDelay * 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [hasNearby, visibilityMode, hideDelay, visible]);

  return visibilityMode === 'always' || dragMode ? true : visible;
};

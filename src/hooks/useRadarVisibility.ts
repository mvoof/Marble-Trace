import { useState, useEffect, useRef, useMemo } from 'react';

import type { NearbyCar } from '../types/bindings';
import type { RadarSettings } from '../store/widget-settings.store';
import { appSettingsStore } from '../store/app-settings.store';

export const useRadarVisibility = (
  nearbyCars: NearbyCar[],
  settings: RadarSettings,
  hasSpotterContact: boolean = false
): boolean => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setVisible(true);
    } else if (visible && !hideTimerRef.current) {
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        hideTimerRef.current = null;
      }, hideDelay * 1000);
    }
  }, [hasNearby, visibilityMode, hideDelay, visible]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return visibilityMode === 'always' || dragMode ? true : visible;
};

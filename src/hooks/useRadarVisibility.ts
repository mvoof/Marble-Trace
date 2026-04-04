import { useState, useEffect, useRef, useMemo } from 'react';

import type { NearbyCarInfo } from '../utils/proximity';
import type { RadarSettings } from '../store/widget-settings.store';
import { appSettingsStore } from '../store/app-settings.store';

/**
 * Controls radar widget visibility based on proximity settings.
 * Returns `true` when the widget should be visible.
 */
export const useRadarVisibility = (
  nearbyCars: NearbyCarInfo[],
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return visibilityMode === 'always' || dragMode ? true : visible;
};

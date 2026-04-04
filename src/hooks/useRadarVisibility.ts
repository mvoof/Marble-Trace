import { useState, useEffect, useRef } from 'react';

import type { NearbyCarInfo } from '../utils/proximity';
import type { RadarSettings } from '../store/widget-settings.store';

/**
 * Controls radar widget visibility based on proximity settings.
 * Returns `true` when the widget should be visible.
 */
export const useRadarVisibility = (
  nearbyCars: NearbyCarInfo[],
  settings: RadarSettings
): boolean => {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { visibilityMode, proximityThreshold, hideDelay } = settings;

  useEffect(() => {
    if (visibilityMode === 'always') {
      setVisible(true);
      return;
    }

    const hasNearby = nearbyCars.some(
      (car) => car.clearance <= proximityThreshold
    );

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

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [nearbyCars, visibilityMode, proximityThreshold, hideDelay, visible]);

  return visibilityMode === 'always' ? true : visible;
};

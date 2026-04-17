import { useMemo, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import {
  computeNearbyCars,
  computeRadarDistances,
  parseTrackLength,
  parseSpotterState,
} from '../../../utils/proximity';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { RadarBarWidget } from './RadarBarWidget';

const CAR_SEARCH_RADIUS = 10.0;

interface RadarBarWidgetContainerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const RadarBarWidgetContainer = observer(
  ({ onVisibilityChange }: RadarBarWidgetContainerProps) => {
    const carIdx = telemetryStore.carIdx;
    const { driverInfo, weekendInfo } = telemetryStore;
    const radarSettings = widgetSettingsStore.getRadarSettings('radar-bar');

    const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
    const trackLength = useMemo(
      () => parseTrackLength(weekendInfo?.TrackLength ?? ''),
      [weekendInfo?.TrackLength]
    );

    const carLeftRight = carIdx?.car_left_right ?? 0;

    const nearbyCars = useMemo(() => {
      if (!carIdx || playerCarIdx === null || trackLength <= 0) return [];
      return computeNearbyCars(
        carIdx,
        playerCarIdx,
        trackLength,
        CAR_SEARCH_RADIUS,
        carLeftRight
      );
    }, [carIdx, playerCarIdx, trackLength, carLeftRight]);

    const spotter = useMemo(
      () => parseSpotterState(carLeftRight),
      [carLeftRight]
    );

    const radarDistances = useMemo(
      () => computeRadarDistances(nearbyCars, spotter),
      [nearbyCars, spotter]
    );

    const visible = useRadarVisibility(
      nearbyCars,
      radarSettings,
      spotter.left || spotter.right
    );

    const onVisibilityChangeRef = useRef(onVisibilityChange);
    onVisibilityChangeRef.current = onVisibilityChange;

    useEffect(() => {
      onVisibilityChangeRef.current?.(visible);
    }, [visible]);

    if (!visible) return null;

    return (
      <RadarBarWidget
        radarDistances={radarDistances}
        spotter={spotter}
        settings={radarSettings}
      />
    );
  }
);

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
import { ProximityRadarWidget } from './ProximityRadarWidget';

const CAR_SEARCH_RADIUS = 30;

interface ProximityRadarWidgetContainerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const ProximityRadarWidgetContainer = observer(
  ({ onVisibilityChange }: ProximityRadarWidgetContainerProps) => {
    const carIdx = telemetryStore.carIdx;
    const { driverInfo, weekendInfo } = telemetryStore;
    const radarSettings =
      widgetSettingsStore.getRadarSettings('proximity-radar');

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
      <ProximityRadarWidget radarDistances={radarDistances} spotter={spotter} />
    );
  }
);

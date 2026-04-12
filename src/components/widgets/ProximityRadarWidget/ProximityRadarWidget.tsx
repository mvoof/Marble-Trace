import { useMemo, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives/WidgetPanel';
import { telemetryStore } from '../../../store/iracing';
import {
  computeNearbyCars,
  computeRadarDistances,
  parseTrackLength,
  parseSpotterState,
} from '../../../utils/proximity';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { RadarDisplay } from './components/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

/** Longitudinal search radius (meters) — cars within this range are computed */
const CAR_SEARCH_RADIUS = 30;

/** Max distance (meters) at which cars are visually rendered on the radar display */
const RADAR_RENDER_RANGE = 10;

interface ProximityRadarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const ProximityRadarWidget = observer(
  ({ onVisibilityChange }: ProximityRadarWidgetProps) => {
    const carIdx = telemetryStore.carIdx;
    const { driverInfo, weekendInfo } = telemetryStore;
    const radarSettings =
      widgetSettingsStore.getRadarSettings('proximity-radar');

    const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
    const trackLengthStr = weekendInfo?.TrackLength ?? '';
    const trackLength = useMemo(
      () => parseTrackLength(trackLengthStr),
      [trackLengthStr]
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

    // Notify parent wrapper about visibility changes
    useEffect(() => {
      onVisibilityChange?.(visible);
    }, [visible, onVisibilityChange]);

    if (!visible) return null;

    return (
      <WidgetPanel className={styles.root} minWidth={100} gap={0}>
        <RadarDisplay
          radarDistances={radarDistances}
          spotter={spotter}
          renderRange={RADAR_RENDER_RANGE}
        />
      </WidgetPanel>
    );
  }
);

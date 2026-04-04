import { useMemo, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives/WidgetPanel';
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
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

const MAX_RADAR_DIST = 30;

interface ProximityRadarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const ProximityRadarWidget = observer(
  ({ onVisibilityChange }: ProximityRadarWidgetProps) => {
    const carIdx = useCarIdx();
    const { driverInfo, weekendInfo } = useSession();
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
        MAX_RADAR_DIST,
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
          maxDist={MAX_RADAR_DIST}
        />
      </WidgetPanel>
    );
  }
);

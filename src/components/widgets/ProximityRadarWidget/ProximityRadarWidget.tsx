import { useMemo } from 'react';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '../primitives/WidgetPanel';
import { useCarIdx, useSession } from '../../../hooks/useIracingData';
import {
  computeNearbyCars,
  computeFrontRearDistances,
  computeSideCarDistances,
  parseTrackLength,
  parseSpotterState,
} from '../../../utils/proximity';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { RadarDisplay } from './components/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

const MAX_RADAR_DIST = 30;

export const ProximityRadarWidget = observer(() => {
  const carIdx = useCarIdx();
  const { driverInfo, weekendInfo } = useSession();
  const radarSettings = widgetSettingsStore.getRadarSettings('proximity-radar');

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

  const distances = useMemo(
    () => computeFrontRearDistances(nearbyCars),
    [nearbyCars]
  );

  const spotter = useMemo(
    () => parseSpotterState(carLeftRight),
    [carLeftRight]
  );

  const sideCars = useMemo(
    () => computeSideCarDistances(nearbyCars),
    [nearbyCars]
  );

  const visible = useRadarVisibility(nearbyCars, radarSettings);

  if (!visible) return null;

  return (
    <WidgetPanel className={styles.root} minWidth={100} gap={0}>
      <RadarDisplay
        distances={distances}
        spotter={spotter}
        sideCars={sideCars}
        maxDist={MAX_RADAR_DIST}
      />
    </WidgetPanel>
  );
});

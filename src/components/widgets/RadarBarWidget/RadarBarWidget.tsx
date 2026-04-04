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
import { RadarBar } from './components/RadarBar';

import styles from './RadarBarWidget.module.scss';

/** Max longitudinal search range — cars within this range are candidates for side bars */
const MAX_SIDE_DIST = 10.0;

interface RadarBarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const RadarBarWidget = observer(
  ({ onVisibilityChange }: RadarBarWidgetProps) => {
    const carIdx = useCarIdx();
    const { driverInfo, weekendInfo } = useSession();
    const radarSettings = widgetSettingsStore.getRadarSettings('radar-bar');

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
        MAX_SIDE_DIST,
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
    const sideCars = radarDistances.sideCars;

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
      <WidgetPanel
        className={styles.root}
        minWidth={60}
        gap={0}
        direction="row"
      >
        <RadarBar
          active={spotter.left}
          dist={sideCars.leftDist ?? 0}
          side="left"
        />

        <RadarBar
          active={spotter.right}
          dist={sideCars.rightDist ?? 0}
          side="right"
        />
      </WidgetPanel>
    );
  }
);

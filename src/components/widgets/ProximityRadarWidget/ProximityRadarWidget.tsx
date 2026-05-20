import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { RadarDisplay } from './RadarDisplay/RadarDisplay';

import styles from './ProximityRadarWidget.module.scss';

const CAR_SEARCH_RADIUS = 30;

interface ProximityRadarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const ProximityRadarWidget = observer(
  ({ onVisibilityChange }: ProximityRadarWidgetProps) => {
    const proximity = computedStore.proximity;
    const radarSettings =
      widgetSettingsStore.getRadarSettings('proximity-radar');

    const nearbyCars =
      proximity?.nearbyCars.filter(
        (car) => car.clearance <= CAR_SEARCH_RADIUS
      ) ?? [];

    const spotterLeft = proximity?.spotterLeft ?? false;
    const spotterRight = proximity?.spotterRight ?? false;

    const visible = useRadarVisibility(
      nearbyCars,
      radarSettings,
      spotterLeft || spotterRight
    );

    const onVisibilityChangeRef = useRef(onVisibilityChange);
    onVisibilityChangeRef.current = onVisibilityChange;

    useEffect(() => {
      onVisibilityChangeRef.current?.(visible);
    }, [visible]);

    if (!visible || !proximity) {
      return null;
    }

    return (
      <WidgetPanel className={styles.root} minWidth={100} gap={0}>
        <RadarDisplay />
      </WidgetPanel>
    );
  }
);

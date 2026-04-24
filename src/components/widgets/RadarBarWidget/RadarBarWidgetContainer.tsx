import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { RadarBarWidget } from './RadarBarWidget';

const CAR_SEARCH_RADIUS = 10.0;

interface RadarBarWidgetContainerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const RadarBarWidgetContainer = observer(
  ({ onVisibilityChange }: RadarBarWidgetContainerProps) => {
    const proximity = computedStore.proximity;
    const radarSettings = widgetSettingsStore.getRadarSettings('radar-bar');

    const nearbyCars =
      proximity?.nearbyCars.filter((c) => c.clearance <= CAR_SEARCH_RADIUS) ??
      [];

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

    if (!visible || !proximity) return null;

    return (
      <RadarBarWidget
        radarDistances={proximity.radarDistances}
        spotterLeft={spotterLeft}
        spotterRight={spotterRight}
        settings={radarSettings}
      />
    );
  }
);

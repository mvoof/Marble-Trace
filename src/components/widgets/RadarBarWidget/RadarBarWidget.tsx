import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../store/iracing/computed.store';
import { unitsStore } from '../../../store/units.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { distanceUnit, formatDistance } from '../../../utils/telemetry-format';
import { useRadarVisibility } from '../../../hooks/useRadarVisibility';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { RadarBar } from './RadarBar/RadarBar';

import styles from './RadarBarWidget.module.scss';

const CAR_SEARCH_RADIUS = 10.0;

interface RadarBarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const RadarBarWidget = observer(
  ({ onVisibilityChange }: RadarBarWidgetProps) => {
    const proximity = computedStore.proximity;
    const { system } = unitsStore;
    const radarSettings = widgetSettingsStore.getRadarSettings('radar-bar');

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

    const { leftDist, rightDist } = proximity.radarDistances;
    const activeOnly = radarSettings.barDisplayMode === 'active-only';
    const showLeft = activeOnly ? spotterLeft : true;
    const showRight = activeOnly ? spotterRight : true;
    const formatDistanceFn = (meters: number) => formatDistance(meters, system);
    const distanceUnitLabel = distanceUnit(system);

    return (
      <WidgetPanel
        className={styles.root}
        minWidth={60}
        gap={0}
        direction="row"
        edgeInset
      >
        {showLeft && (
          <div className={styles.leftSlot}>
            <RadarBar
              active={spotterLeft}
              dist={leftDist ?? 0}
              side="left"
              formatDistance={formatDistanceFn}
              distanceUnit={distanceUnitLabel}
            />
          </div>
        )}

        {showRight && (
          <div className={styles.rightSlot}>
            <RadarBar
              active={spotterRight}
              dist={rightDist ?? 0}
              side="right"
              formatDistance={formatDistanceFn}
              distanceUnit={distanceUnitLabel}
            />
          </div>
        )}
      </WidgetPanel>
    );
  }
);

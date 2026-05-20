import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { useRadarVisibility } from '@hooks/common/useRadarVisibility';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { RadarBar } from './RadarBar/RadarBar';

import styles from './RadarBarWidget.module.scss';

const CAR_SEARCH_RADIUS = 10.0;

interface RadarBarWidgetProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export const RadarBarWidget = observer(
  ({ onVisibilityChange }: RadarBarWidgetProps) => {
    const proximity = computedStore.proximity;
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

    const activeOnly = radarSettings.barDisplayMode === 'active-only';
    const showLeft = activeOnly ? spotterLeft : true;
    const showRight = activeOnly ? spotterRight : true;

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
            <RadarBar side="left" />
          </div>
        )}

        {showRight && (
          <div className={styles.rightSlot}>
            <RadarBar side="right" />
          </div>
        )}
      </WidgetPanel>
    );
  }
);

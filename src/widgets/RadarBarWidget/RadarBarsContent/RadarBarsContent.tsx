import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { useRadarVisibility } from '@hooks/common/useRadarVisibility';
import { useWidgetAutoHide } from '@hooks/common/useWidgetAutoHide';
import { RadarBar } from '../RadarBar/RadarBar';

import styles from './RadarBarsContent.module.scss';

const CAR_SEARCH_RADIUS = 10.0;

export const RadarBarsContent = observer(() => {
  const proximity = computedStore.proximity;
  const radarSettings = widgetSettingsStore.getRadarSettings('radar-bar');

  const nearbyCars =
    proximity?.nearbyCars.filter((car) => car.clearance <= CAR_SEARCH_RADIUS) ??
    [];

  const spotterLeft = proximity?.spotterLeft ?? false;
  const spotterRight = proximity?.spotterRight ?? false;

  const visible = useRadarVisibility(
    nearbyCars,
    radarSettings,
    spotterLeft || spotterRight
  );

  useWidgetAutoHide(visible);

  if (!visible || !proximity) {
    return null;
  }

  const activeOnly = radarSettings.barDisplayMode === 'active-only';
  const showLeft = activeOnly ? spotterLeft : true;
  const showRight = activeOnly ? spotterRight : true;

  return (
    <>
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
    </>
  );
});

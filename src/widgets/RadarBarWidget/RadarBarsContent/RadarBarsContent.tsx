import { observer } from 'mobx-react-lite';

import { useProximityRadarData } from '@hooks/common/useProximityRadarData';
import { RadarBar } from '../RadarBar/RadarBar';

import styles from './RadarBarsContent.module.scss';

const BAR_SEARCH_RADIUS = 10;

export const RadarBarsContent = observer(() => {
  const { proximity, radarSettings, spotterLeft, spotterRight, visible } =
    useProximityRadarData('radar-bar', BAR_SEARCH_RADIUS);

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

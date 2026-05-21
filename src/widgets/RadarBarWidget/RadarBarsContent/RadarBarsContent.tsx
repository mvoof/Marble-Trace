import { observer } from 'mobx-react-lite';

import { useProximityRadarData } from '@hooks/common/useProximityRadarData';
import { RadarBar } from '../RadarBar/RadarBar';

import styles from './RadarBarsContent.module.scss';

const BAR_SEARCH_RADIUS = 10;

export const RadarBarsContent = observer(() => {
  const { proximity, visible } = useProximityRadarData(
    'radar-bar',
    BAR_SEARCH_RADIUS
  );

  if (!visible || !proximity) {
    return null;
  }

  return (
    <>
      <div className={styles.leftSlot}>
        <RadarBar side="left" />
      </div>

      <div className={styles.rightSlot}>
        <RadarBar side="right" />
      </div>
    </>
  );
});

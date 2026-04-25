import { formatLapTime } from '../../../../utils/telemetry-format';
import { SECTOR_ARC_COLORS } from '../track-map-utils';

import styles from './SectorTimesStrip.module.scss';

interface SectorEntry {
  sectorNum: number;
}

interface SectorTimesStripProps {
  sectors: SectorEntry[];
  sectorTimes: (number | null)[];
  currentSectorIdx?: number;
}

export const SectorTimesStrip = ({
  sectors,
  sectorTimes,
  currentSectorIdx = -1,
}: SectorTimesStripProps) => (
  <div className={styles.strip}>
    {sectors.map((sector, i) => {
      const time = sectorTimes[i] ?? null;
      const color = SECTOR_ARC_COLORS[i % SECTOR_ARC_COLORS.length];

      const isLive = i === currentSectorIdx;
      const isPreviousLap = i > currentSectorIdx && time !== null;

      const itemClasses = [
        styles.item,
        isLive ? styles.live : '',
        isPreviousLap ? styles.previousLap : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <div key={sector.sectorNum} className={itemClasses}>
          <span className={styles.dot} style={{ backgroundColor: color }} />
          <span className={styles.label}>S{sector.sectorNum + 1}</span>
          <span className={styles.time}>{formatLapTime(time)}</span>
        </div>
      );
    })}
  </div>
);

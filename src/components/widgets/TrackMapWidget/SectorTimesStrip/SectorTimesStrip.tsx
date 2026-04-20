import { formatLapTime } from '../../../../utils/telemetry-format';
import { SECTOR_ARC_COLORS } from '../track-map-utils';

import styles from './SectorTimesStrip.module.scss';

interface SectorEntry {
  sectorNum: number;
}

interface SectorTimesStripProps {
  sectors: SectorEntry[];
  sectorTimes: (number | null)[];
}

export const SectorTimesStrip = ({
  sectors,
  sectorTimes,
}: SectorTimesStripProps) => (
  <div className={styles.strip}>
    {sectors.map((sector, i) => {
      const time = sectorTimes[i] ?? null;
      const color = SECTOR_ARC_COLORS[i % SECTOR_ARC_COLORS.length];

      return (
        <div key={sector.sectorNum} className={styles.item}>
          <span className={styles.dot} style={{ backgroundColor: color }} />
          <span className={styles.label}>S{sector.sectorNum + 1}</span>
          <span className={styles.time}>{formatLapTime(time)}</span>
        </div>
      );
    })}
  </div>
);

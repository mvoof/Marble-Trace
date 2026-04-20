import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './LapTimesWidget.module.scss';

interface LapTimesWidgetProps {
  currentLapTime: string;
  lastLapTime: string;
  bestLapTime: string;
  hasBestLap: boolean;
}

interface LapRowProps {
  label: string;
  value: string;
  accent?: boolean;
}

const LapRow = ({ label, value, accent = false }: LapRowProps) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <span className={`${styles.value} ${accent ? styles.valueAccent : ''}`}>
      {value}
    </span>
  </div>
);

export const LapTimesWidget = ({
  currentLapTime,
  lastLapTime,
  bestLapTime,
  hasBestLap,
}: LapTimesWidgetProps) => (
  <WidgetPanel direction="column" gap={0} minWidth={200}>
    <LapRow label="CURRENT" value={currentLapTime} />
    <div className={styles.divider} />
    <LapRow label="LAST" value={lastLapTime} />
    <div className={styles.divider} />
    <LapRow label="BEST" value={bestLapTime} accent={hasBestLap} />
  </WidgetPanel>
);

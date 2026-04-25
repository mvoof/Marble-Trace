import { WidgetPanel } from '../primitives/WidgetPanel';
import type { LapTimesWidgetSettings } from '../../../types/widget-settings';

import styles from './LapTimesWidget.module.scss';

interface LapTimesWidgetProps {
  currentLapTime: string;
  lastLapTime: string;
  lastLapDelta: string;
  bestLapTime: string;
  p1LapTime: string;
  p1Delta: string;
  settings: LapTimesWidgetSettings;
}

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  rowClass: string;
}

export const LapTimesWidget = ({
  currentLapTime,
  lastLapTime,
  lastLapDelta,
  bestLapTime,
  p1LapTime,
  p1Delta,
  settings,
}: LapTimesWidgetProps) => {
  const rows: RowConfig[] = [
    {
      label: 'CURRENT',
      time: currentLapTime,
      delta: '—',
      rowClass: styles.rowCurrent,
    },
  ];

  if (settings.showLastLap) {
    rows.push({
      label: 'LAST',
      time: lastLapTime,
      delta: lastLapDelta,
      rowClass: styles.rowLast,
    });
  }

  if (settings.showBestLap) {
    rows.push({
      label: 'BEST',
      time: bestLapTime,
      delta: '—',
      rowClass: styles.rowBest,
    });
  }

  if (settings.showP1) {
    rows.push({
      label: 'P1',
      time: p1LapTime,
      delta: p1Delta,
      rowClass: styles.rowP1,
    });
  }

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      {rows.map(({ label, time, delta, rowClass }) => (
        <div key={label} className={`${styles.row} ${rowClass}`}>
          <span className={styles.label}>{label}</span>
          <span className={styles.time}>{time}</span>
          <span className={styles.delta}>{delta}</span>
        </div>
      ))}
    </WidgetPanel>
  );
};

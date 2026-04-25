import { WidgetPanel } from '../primitives/WidgetPanel';

import styles from './LapTimesWidget.module.scss';

interface LapTimesWidgetProps {
  lastLapTime: string;
  lastLapDelta: string;
  bestLapTime: string;
  p1LapTime: string;
  p1Delta: string;
}

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  rowClass: string;
}

export const LapTimesWidget = ({
  lastLapTime,
  lastLapDelta,
  bestLapTime,
  p1LapTime,
  p1Delta,
}: LapTimesWidgetProps) => {
  const rows: RowConfig[] = [
    {
      label: 'LAST',
      time: lastLapTime,
      delta: lastLapDelta,
      rowClass: styles.rowLast,
    },
    { label: 'BEST', time: bestLapTime, delta: '—', rowClass: styles.rowBest },
    { label: 'OPTIMAL', time: '—', delta: '—', rowClass: styles.rowOptimal },
    { label: 'P1', time: p1LapTime, delta: p1Delta, rowClass: styles.rowP1 },
  ];

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

import { TimingRow } from '../../shared/TimingRow/TimingRow';
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

const COLOR_CURRENT = '#22c55e';
const COLOR_LAST = '#ef4444';
const COLOR_BEST = 'rgba(192, 132, 252, 0.85)';
const COLOR_P1 = 'rgba(192, 132, 252, 0.85)';

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
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
      accentColor: COLOR_CURRENT,
    },
  ];

  if (settings.showLastLap) {
    rows.push({
      label: 'LAST',
      time: lastLapTime,
      delta: lastLapDelta,
      accentColor: COLOR_LAST,
    });
  }

  if (settings.showBestLap) {
    rows.push({
      label: 'BEST',
      time: bestLapTime,
      delta: '—',
      accentColor: COLOR_BEST,
    });
  }

  if (settings.showP1) {
    rows.push({
      label: 'P1',
      time: p1LapTime,
      delta: p1Delta,
      accentColor: COLOR_P1,
    });
  }

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      <div
        className={
          settings.layout === 'horizontal'
            ? styles.rowListHorizontal
            : styles.rowListVertical
        }
      >
        {rows.map((row) => (
          <TimingRow
            key={row.label}
            label={row.label}
            time={row.time}
            delta={row.delta}
            accentColor={row.accentColor}
          />
        ))}
      </div>
    </WidgetPanel>
  );
};

import { forwardRef } from 'react';
import { TimingRow } from '../../shared/TimingRow/TimingRow';
import { WidgetPanel } from '../primitives/WidgetPanel';
import type { LapTimesWidgetSettings } from '../../../types/widget-settings';

import styles from './LapTimesWidget.module.scss';

interface LapTimesWidgetProps {
  currentLapTime: string;
  lastLapTime: string;
  lastDelta: string;
  lastDeltaColor?: string;
  bestLapTime: string;
  bestDelta: string;
  bestDeltaColor?: string;
  p1LapTime: string;
  p1Delta: string;
  p1DeltaColor?: string;
  settings: LapTimesWidgetSettings;
}

const COLOR_CURRENT = '#22c55e';
const COLOR_LAST = '#ef4444';
const COLOR_BEST = 'rgba(192, 132, 252, 0.85)';
const COLOR_P1 = 'rgba(238, 238, 238, 0.85)';

interface RowConfig {
  label: string;
  time: string;
  delta: string;
  accentColor: string;
  deltaColor?: string;
}

export const LapTimesWidget = forwardRef<HTMLElement, LapTimesWidgetProps>(
  (
    {
      currentLapTime,
      lastLapTime,
      lastDelta,
      lastDeltaColor,
      bestLapTime,
      bestDelta,
      bestDeltaColor,
      p1LapTime,
      p1Delta,
      p1DeltaColor,
      settings,
    },
    ref
  ) => {
    const rows: RowConfig[] = [
      {
        label: 'CURRENT',
        time: currentLapTime,
        delta: '',
        accentColor: COLOR_CURRENT,
      },
    ];

    if (settings.showLastLap) {
      rows.push({
        label: 'LAST',
        time: lastLapTime,
        delta: lastDelta,
        accentColor: COLOR_LAST,
        deltaColor: lastDeltaColor,
      });
    }

    if (settings.showBestLap) {
      rows.push({
        label: 'BEST',
        time: bestLapTime,
        delta: bestDelta,
        accentColor: COLOR_BEST,
        deltaColor: bestDeltaColor,
      });
    }

    if (settings.showP1) {
      rows.push({
        label: 'P1',
        time: p1LapTime,
        delta: p1Delta,
        accentColor: COLOR_P1,
        deltaColor: p1DeltaColor,
      });
    }

    return (
      <WidgetPanel
        ref={ref}
        direction="column"
        gap={0}
        minWidth={200}
        fitContent
      >
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
              deltaColor={row.deltaColor}
            />
          ))}
        </div>
      </WidgetPanel>
    );
  }
);

LapTimesWidget.displayName = 'LapTimesWidget';

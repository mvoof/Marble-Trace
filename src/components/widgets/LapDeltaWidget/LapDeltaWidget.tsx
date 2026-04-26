import { forwardRef } from 'react';
import { TimingRow } from '../../shared/TimingRow/TimingRow';
import { WidgetPanel } from '../primitives/WidgetPanel';
import {
  getDeltaColor,
  getSectorDeltaState,
  formatSectorDelta,
  formatSectorTime,
  SECTOR_ACCENT_COLORS,
} from './lap-delta-utils';
import type { DeltaState, LapDeltaLayout } from './lap-delta-utils';

import styles from './LapDeltaWidget.module.scss';

interface LapDeltaWidgetProps {
  deltaFormatted: string;
  deltaState: DeltaState;
  sectorDeltas: (number | null)[];
  sectorTimes: (number | null)[];
  layout: LapDeltaLayout;
}

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

export const LapDeltaWidget = forwardRef<HTMLElement, LapDeltaWidgetProps>(
  ({ deltaFormatted, deltaState, sectorDeltas, sectorTimes, layout }, ref) => {
    const sectorCount = Math.max(sectorDeltas.length, sectorTimes.length);
    const sectors = Array.from({ length: sectorCount }, (_, i) => ({
      time: sectorTimes[i] ?? null,
      delta: sectorDeltas[i] ?? null,
      accent: SECTOR_ACCENT_COLORS[i % SECTOR_ACCENT_COLORS.length],
    }));

    return (
      <WidgetPanel
        ref={ref}
        direction="column"
        gap={0}
        minWidth={150}
        fitContent
      >
        <div
          className={`${styles.delta} ${DELTA_STATE_CLASS[deltaState]} ${layout === 'horizontal' ? styles.deltaHorizontal : ''}`}
        >
          {deltaFormatted}
        </div>

        <div
          className={
            layout === 'horizontal'
              ? styles.sectorListHorizontal
              : styles.sectorListVertical
          }
        >
          {sectors.map((s, i) => (
            <TimingRow
              key={i}
              label={`S${i + 1}`}
              time={formatSectorTime(s.time)}
              delta={formatSectorDelta(s.delta)}
              accentColor={s.accent}
              deltaColor={getDeltaColor(getSectorDeltaState(s.delta))}
            />
          ))}
        </div>
      </WidgetPanel>
    );
  }
);

LapDeltaWidget.displayName = 'LapDeltaWidget';

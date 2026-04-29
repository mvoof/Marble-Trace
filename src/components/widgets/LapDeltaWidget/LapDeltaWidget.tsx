import {
  forwardRef,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react';
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

export interface DeltaDisplayHandle {
  update: (text: string, state: DeltaState) => void;
}

interface LapDeltaWidgetProps {
  initialDeltaFormatted: string;
  initialDeltaState: DeltaState;
  sectorDeltas: (number | null)[];
  sectorTimes: (number | null)[];
  layout: LapDeltaLayout;
  showSectorTimes: boolean;
  deltaDisplayRef: RefObject<DeltaDisplayHandle | null>;
}

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

export const LapDeltaWidget = forwardRef<HTMLElement, LapDeltaWidgetProps>(
  (
    {
      initialDeltaFormatted,
      initialDeltaState,
      sectorDeltas,
      sectorTimes,
      layout,
      showSectorTimes,
      deltaDisplayRef,
    },
    ref
  ) => {
    const deltaDivRef = useRef<HTMLDivElement>(null);

    const assignDeltaDisplayHandle = (el: HTMLDivElement | null) => {
      (deltaDivRef as MutableRefObject<HTMLDivElement | null>).current = el;
      if (deltaDisplayRef && 'current' in deltaDisplayRef) {
        (
          deltaDisplayRef as MutableRefObject<DeltaDisplayHandle | null>
        ).current = el
          ? {
              update: (text, state) => {
                el.textContent = text;
                el.className = [
                  styles.delta,
                  DELTA_STATE_CLASS[state],
                  layout === 'horizontal' ? styles.deltaHorizontal : '',
                ]
                  .filter(Boolean)
                  .join(' ');
              },
            }
          : null;
      }
    };

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
          ref={assignDeltaDisplayHandle}
          className={`${styles.delta} ${DELTA_STATE_CLASS[initialDeltaState]} ${layout === 'horizontal' ? styles.deltaHorizontal : ''}`}
        >
          {initialDeltaFormatted}
        </div>

        {showSectorTimes && (
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
        )}
      </WidgetPanel>
    );
  }
);

LapDeltaWidget.displayName = 'LapDeltaWidget';

import { useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import styles from './PitPanel.module.scss';

export type PitState = 'pit-lane' | 'limiter-active' | 'over-limit';

interface PitPanelProps {
  initialState: PitState;
  limitSpeed: string;
  speedUnit: string;
  initialDelta: number | null;
  ref?: Ref<PitPanelHandle>;
}

export interface PitPanelHandle {
  update: (state: PitState, delta: number | null) => void;
}

const PIT_STATE_LABEL: Record<PitState, string> = {
  'pit-lane': 'PIT LANE',
  'limiter-active': 'PIT LIMITER',
  'over-limit': 'REDUCE SPEED',
};

const PIT_STATE_CLASS: Record<PitState, string> = {
  'pit-lane': styles.stateYellow,
  'limiter-active': styles.stateSafe,
  'over-limit': styles.stateWarn,
};

const getDeltaClass = (delta: number): string => {
  if (delta > 0) return styles.deltaOver;
  if (delta >= -5) return styles.deltaClose;
  return styles.deltaOk;
};

const formatDelta = (delta: number): string => {
  if (delta > 0) return `+${delta}`;
  if (delta === 0) return '±0';
  return `${delta}`;
};

export const PitPanel = ({
  initialState,
  limitSpeed,
  speedUnit,
  initialDelta,
  ref,
}: PitPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const deltaRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    update: (state, delta) => {
      if (panelRef.current) {
        panelRef.current.className = `${styles.panel} ${PIT_STATE_CLASS[state]}`;
      }
      if (labelRef.current) {
        labelRef.current.textContent = PIT_STATE_LABEL[state];
      }
      if (deltaRef.current) {
        if (delta !== null) {
          deltaRef.current.textContent = formatDelta(delta);
          deltaRef.current.className = `${styles.delta} ${getDeltaClass(delta)}`;
          deltaRef.current.style.display = '';
        } else {
          deltaRef.current.style.display = 'none';
        }
      }
    },
  }));

  return (
    <div
      ref={panelRef}
      className={`${styles.panel} ${PIT_STATE_CLASS[initialState]}`}
    >
      <span ref={labelRef} className={styles.label}>
        {PIT_STATE_LABEL[initialState]}
      </span>

      <div className={styles.right}>
        <span className={styles.limit}>{limitSpeed}</span>
        <span className={styles.unit}>{speedUnit}</span>

        <span
          ref={deltaRef}
          className={`${styles.delta} ${initialDelta !== null ? getDeltaClass(initialDelta) : ''}`}
          style={{ display: initialDelta !== null ? '' : 'none' }}
        >
          {initialDelta !== null ? formatDelta(initialDelta) : ''}
        </span>
      </div>
    </div>
  );
};

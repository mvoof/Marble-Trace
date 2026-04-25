import { WidgetPanel } from '../primitives/WidgetPanel';
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

const SECTOR_ROW_CLASS = [
  styles.sectorRow0,
  styles.sectorRow1,
  styles.sectorRow2,
  styles.sectorRow3,
  styles.sectorRow4,
  styles.sectorRow5,
];

const sectorDeltaClass = (v: number | null): string => {
  if (v === null) return styles.sectorNeutral;
  if (v < -0.001) return styles.sectorAhead;
  if (v > 0.001) return styles.sectorBehind;
  return styles.sectorNeutral;
};

const formatSectorDelta = (v: number | null): string => {
  if (v === null) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
};

const formatSectorTime = (v: number | null): string => {
  if (v === null) return '--';
  const m = Math.floor(v / 60);
  const s = v % 60;
  return m > 0
    ? `${m}:${s.toFixed(3).padStart(6, '0')}`
    : s.toFixed(3).padStart(6, '0');
};

const SectorRow = ({
  index,
  time,
  delta,
}: {
  index: number;
  time: number | null;
  delta: number | null;
}) => (
  <div
    className={`${styles.sectorRow} ${SECTOR_ROW_CLASS[index % SECTOR_ROW_CLASS.length]}`}
  >
    <span className={styles.sectorLabel}>{`S${index + 1}`}</span>
    <span className={styles.sectorTime}>{formatSectorTime(time)}</span>
    <span className={`${styles.sectorDelta} ${sectorDeltaClass(delta)}`}>
      {formatSectorDelta(delta)}
    </span>
  </div>
);

export const LapDeltaWidget = ({
  deltaFormatted,
  deltaState,
  sectorDeltas,
  sectorTimes,
  layout,
}: LapDeltaWidgetProps) => {
  const sectorCount = Math.max(sectorDeltas.length, sectorTimes.length);
  const sectors = Array.from({ length: sectorCount }, (_, i) => ({
    time: sectorTimes[i] ?? null,
    delta: sectorDeltas[i] ?? null,
  }));

  return (
    <WidgetPanel direction="column" gap={0} minWidth={150}>
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
          <SectorRow key={i} index={i} time={s.time} delta={s.delta} />
        ))}
      </div>
    </WidgetPanel>
  );
};

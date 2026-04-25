import { WidgetPanel } from '../primitives/WidgetPanel';
import type { DeltaState } from './lap-delta-utils';

import styles from './LapDeltaWidget.module.scss';

interface LapDeltaWidgetProps {
  deltaFormatted: string;
  deltaState: DeltaState;
  currentLap: number | null;
  totalLaps: string | null;
  sectorDeltas: (number | null)[];
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

const sectorValueClass = (v: number | null): string => {
  if (v === null) return styles.sectorNeutral;
  if (v < -0.001) return styles.sectorAhead;
  if (v > 0.001) return styles.sectorBehind;
  return styles.sectorNeutral;
};

const formatSectorDelta = (v: number | null): string => {
  if (v === null) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
};

const formatLapCount = (
  current: number | null,
  total: string | null
): string => {
  const cur = current !== null ? current : '—';
  const tot = total && total.toLowerCase() !== 'unlimited' ? total : '∞';
  return `LAP ${cur}/${tot}`;
};

export const LapDeltaWidget = ({
  deltaFormatted,
  deltaState,
  currentLap,
  totalLaps,
  sectorDeltas,
}: LapDeltaWidgetProps) => (
  <WidgetPanel direction="column" gap={0} minWidth={200}>
    <div className={styles.header}>
      <span className={styles.headerLabel}>
        {formatLapCount(currentLap, totalLaps)}
      </span>
    </div>

    <div className={`${styles.delta} ${DELTA_STATE_CLASS[deltaState]}`}>
      {deltaFormatted}
    </div>

    <div className={styles.sectorList}>
      {sectorDeltas.map((val, i) => (
        <div
          key={i}
          className={`${styles.sectorRow} ${SECTOR_ROW_CLASS[i % 6]}`}
        >
          <span className={styles.sectorLabel}>{`S${i + 1}`}</span>
          <span className={`${styles.sectorValue} ${sectorValueClass(val)}`}>
            {formatSectorDelta(val)}
          </span>
        </div>
      ))}
    </div>
  </WidgetPanel>
);

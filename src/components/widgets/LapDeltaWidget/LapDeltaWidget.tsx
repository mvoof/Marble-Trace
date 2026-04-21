import { WidgetPanel } from '../primitives/WidgetPanel';
import type { DeltaState } from './lap-delta-utils';

import styles from './LapDeltaWidget.module.scss';

interface LapDeltaWidgetProps {
  deltaFormatted: string;
  deltaState: DeltaState;
  currentLap: number | null;
  totalLaps: string | null;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
}

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

const sectorStateClass = (v: number | null): string => {
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

const SECTORS = ['S1', 'S2', 'S3'] as const;

export const LapDeltaWidget = ({
  deltaFormatted,
  deltaState,
  currentLap,
  totalLaps,
  s1Delta,
  s2Delta,
  s3Delta,
}: LapDeltaWidgetProps) => {
  const sectorValues = [s1Delta, s2Delta, s3Delta];

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Δ OPTIMAL</span>
        <span className={styles.headerLabel}>
          {formatLapCount(currentLap, totalLaps)}
        </span>
      </div>

      <div className={`${styles.delta} ${DELTA_STATE_CLASS[deltaState]}`}>
        {deltaFormatted}
      </div>

      <div className={styles.sectorGrid}>
        {SECTORS.map((label, i) => {
          const val = sectorValues[i];
          const cls = sectorStateClass(val);
          return (
            <div key={label} className={`${styles.sectorCell} ${cls}`}>
              <span className={styles.sectorLabel}>{label}</span>
              <span className={styles.sectorValue}>
                {formatSectorDelta(val)}
              </span>
            </div>
          );
        })}
      </div>
    </WidgetPanel>
  );
};

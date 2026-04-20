import { WidgetPanel } from '../primitives/WidgetPanel';
import type { DeltaState } from './lap-delta-utils';

import styles from './LapDeltaWidget.module.scss';

interface LapDeltaWidgetProps {
  deltaFormatted: string;
  deltaState: DeltaState;
  barPct: number;
  bestLapFormatted: string;
  hasDelta: boolean;
}

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

export const LapDeltaWidget = ({
  deltaFormatted,
  deltaState,
  barPct,
  bestLapFormatted,
  hasDelta,
}: LapDeltaWidgetProps) => {
  const deltaClass = DELTA_STATE_CLASS[deltaState];
  const fillWidthPct = `${barPct * 50}%`;

  return (
    <WidgetPanel direction="column" gap={4} minWidth={200}>
      <div className={styles.deltaRow}>
        <span className={`${styles.delta} ${deltaClass}`}>
          {deltaFormatted}
        </span>
      </div>

      <div className={styles.barTrack}>
        <div className={styles.barCenter} />
        {hasDelta && deltaState === 'ahead' && (
          <div
            className={`${styles.barFill} ${styles.barFillAhead}`}
            style={{ width: fillWidthPct }}
          />
        )}
        {hasDelta && deltaState === 'behind' && (
          <div
            className={`${styles.barFill} ${styles.barFillBehind}`}
            style={{ width: fillWidthPct }}
          />
        )}
      </div>

      <div className={styles.reference}>
        <span className={styles.referenceLabel}>BEST</span>
        <span className={styles.referenceValue}>{bestLapFormatted}</span>
      </div>
    </WidgetPanel>
  );
};

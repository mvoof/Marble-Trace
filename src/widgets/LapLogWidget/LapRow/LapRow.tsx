import { observer } from 'mobx-react-lite';
import type { DeltaState } from '@utils/widget/delta-utils';
import styles from './LapRow.module.scss';

type DeltaVariant = DeltaState | 'best';

interface Props {
  lapLabel: string;
  time: string | null;
  deltaLabel?: string;
  deltaVariant?: DeltaVariant;
  isLive?: boolean;
  isBest?: boolean;
}

const DELTA_CLASS: Record<DeltaVariant, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
  best: styles.deltaBest,
};

export const LapRow = observer(
  ({ lapLabel, time, deltaLabel, deltaVariant, isLive, isBest }: Props) => (
    <div
      className={`${styles.row} ${isLive ? styles.rowLive : ''} ${isBest ? styles.rowBest : ''}`}
    >
      <span
        className={`${styles.lapNum} ${isLive ? styles.lapNumLive : ''} ${isBest ? styles.lapNumBest : ''}`}
      >
        {isLive && <span className={styles.liveIcon}>▶</span>}
        {lapLabel}
      </span>

      <span
        className={`${styles.lapTime} ${isBest ? styles.lapTimeBest : ''} ${time === null ? styles.lapTimeInvalid : ''}`}
      >
        {time ?? 'INV'}
      </span>

      {deltaLabel !== undefined && (
        <span className={styles.deltaCell}>
          <span
            className={`${styles.delta} ${deltaVariant ? DELTA_CLASS[deltaVariant] : ''}`}
          >
            {deltaLabel}
          </span>
        </span>
      )}
    </div>
  )
);

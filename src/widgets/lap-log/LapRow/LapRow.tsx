import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { formatDelta } from '@shared/lib/delta-utils';
import {
  paceLossFraction,
  paceLossTone,
  type PaceLossTone,
} from '../lap-log-utils';

import styles from './LapRow.module.scss';

/** The lap being driven, the best lap, a lap with no time, or any other. */
export type LapRowKind = 'live' | 'best' | 'invalid' | 'lap';

const EMPTY_DELTA = '-.---';

const ROW_CLASS: Record<LapRowKind, string> = {
  live: styles.rowLive,
  best: styles.rowBest,
  invalid: styles.rowInvalid,
  lap: '',
};

const TONE_TEXT_CLASS: Record<PaceLossTone, string> = {
  positive: styles.lossGained,
  accent: styles.lossClose,
  danger: styles.lossLost,
};

const TONE_BAR_CLASS: Record<PaceLossTone, string> = {
  positive: '',
  accent: styles.barClose,
  danger: styles.barLost,
};

interface LapRowProps {
  kind: LapRowKind;
  lapNum: number | null;
  /** The lap time, written; ignored on a lap with no time. */
  time: string;
  /** Seconds off the best; null when the lap has none. */
  delta?: number | null;
  /** The delta as a bar of the time lost instead of a chip. */
  paceLossBars?: boolean;
}

interface DeltaCellProps {
  delta: number | null;
  paceLossBars: boolean;
}

/** A finished lap's delta: a chip in its loss color, or a bar of the loss. */
const DeltaCell = observer(({ delta, paceLossBars }: DeltaCellProps) => {
  if (delta === null) {
    return <span className={styles.deltaEmpty}>{EMPTY_DELTA}</span>;
  }

  const tone = paceLossTone(delta);
  const text = formatDelta(delta).trim();

  if (!paceLossBars) {
    return <StatChip lead={text} leadKind="number" tone={tone} emphasized />;
  }

  const fraction = paceLossFraction(delta);

  return (
    <>
      {fraction > 0 && (
        <span
          className={`${styles.bar} ${TONE_BAR_CLASS[tone]}`}
          style={{ width: `${fraction * 100}%` }}
        />
      )}

      <FixedDigits
        className={`${styles.deltaText} ${TONE_TEXT_CLASS[tone]}`}
        text={text}
      />
    </>
  );
});

export const LapRow = observer(
  ({ kind, lapNum, time, delta = null, paceLossBars = false }: LapRowProps) => {
    return (
      <div className={`${styles.row} ${ROW_CLASS[kind]}`}>
        <span className={`${styles.cell} ${styles.lapCell}`}>
          L{lapNum ?? '--'}
        </span>

        <span className={`${styles.cell} ${styles.timeCell}`}>
          {kind === 'invalid' ? (
            <StatChip lead="INV" leadVariant="solid" tone="danger" />
          ) : (
            <FixedDigits className={styles.time} text={time} />
          )}
        </span>

        <span className={`${styles.cell} ${styles.deltaCell}`}>
          {kind === 'live' && (
            <StatChip lead="RUN" leadKind="number" tone="positive" emphasized />
          )}

          {kind === 'best' && (
            <StatChip
              lead="★ BEST"
              leadKind="number"
              tone="special"
              emphasized
            />
          )}

          {kind === 'invalid' && (
            <span className={styles.deltaEmpty}>{EMPTY_DELTA}</span>
          )}

          {kind === 'lap' && (
            <DeltaCell delta={delta} paceLossBars={paceLossBars} />
          )}
        </span>
      </div>
    );
  }
);

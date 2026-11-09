import { observer } from 'mobx-react-lite';

import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { formatDelta } from '@shared/lib/delta-utils';
import { EMPTY_VALUE } from '@shared/lib/telemetry-format';
import {
  paceLossFraction,
  paceLossTone,
  type PaceLossTone,
} from '../lap-log-utils';

import styles from './LapRow.module.scss';

/** The lap being driven, the best lap, a lap with no time, or any other. */
export type LapRowKind = 'live' | 'best' | 'invalid' | 'lap';

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
  /** The lap time, written, or a dash; ignored on a lap with no time. */
  time: string;
  /** Seconds off the best; null when the lap has none. */
  delta?: number | null;
  /** The delta as a bar of the time lost instead of a chip. */
  paceLossBars?: boolean;
  /** The delta column; without it the row is the lap and its time. */
  showDelta?: boolean;
}

interface DeltaCellProps {
  delta: number | null;
  paceLossBars: boolean;
}

/** A finished lap's delta: a chip in its loss color, or a bar of the loss. */
const DeltaCell = observer(({ delta, paceLossBars }: DeltaCellProps) => {
  if (delta === null) {
    return <span className={styles.deltaEmpty}>{EMPTY_VALUE}</span>;
  }

  const tone = paceLossTone(delta);
  const text = formatDelta(delta).trim();

  if (!paceLossBars) {
    return <StatChip lead={text} leadKind="number" look="mark" tone={tone} />;
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
  ({
    kind,
    lapNum,
    time,
    delta = null,
    paceLossBars = false,
    showDelta = true,
  }: LapRowProps) => {
    return (
      <div
        className={`${styles.row} ${ROW_CLASS[kind]} ${showDelta ? '' : styles.rowNoDelta}`}
        data-lap-row
      >
        <span className={`${styles.cell} ${styles.lapCell}`}>
          L{lapNum ?? EMPTY_VALUE}
        </span>

        <span className={`${styles.cell} ${styles.timeCell}`}>
          {kind === 'invalid' || time === EMPTY_VALUE ? (
            <span className={styles.timeEmpty}>{EMPTY_VALUE}</span>
          ) : (
            <FixedDigits className={styles.time} text={time} />
          )}
        </span>

        {showDelta && (
          <span className={`${styles.cell} ${styles.deltaCell}`}>
            {kind === 'live' && (
              <StatChip
                lead="RUN"
                leadKind="number"
                look="reading"
                tone="positive"
              />
            )}

            {kind === 'best' && (
              <StatChip
                lead="★ BEST"
                leadKind="number"
                look="reading"
                tone="special"
              />
            )}

            {kind === 'invalid' && (
              <StatChip lead="INV" look="reading" tone="danger" />
            )}

            {kind === 'lap' && (
              <DeltaCell delta={delta} paceLossBars={paceLossBars} />
            )}
          </span>
        )}
      </div>
    );
  }
);

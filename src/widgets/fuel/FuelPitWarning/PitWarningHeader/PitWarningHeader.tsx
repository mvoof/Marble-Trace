import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import { EMPTY_VALUE } from '@shared/lib/telemetry-format';
import styles from './PitWarningHeader.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { isPitNow } from '../../fuel-utils';

export const PitWarningHeader = observer(() => {
  const { fuel } = useBackendComputedStore();

  const windowStart = fuel?.pitWindowStart ?? null;
  const windowEnd = fuel?.pitWindowEnd ?? null;
  const isNow = isPitNow(fuel?.lapsRemaining ?? null);

  return (
    <div className={styles.pitWarningHeader}>
      <StatChip lead="PIT WINDOW" look="state" tone="accent" />

      {/* Once there is no lap left to name, the range gives way to a call
        louder than the range it stands in for. */}
      {isNow ? (
        <StatChip lead="PIT NOW" look="vivid" tone="danger" />
      ) : (
        <StatChip
          lead="LAP"
          look="reading"
          tone="muted"
          className={styles.lapChip}
        >
          {windowStart ?? EMPTY_VALUE}

          {windowEnd !== null && (
            <span className={styles.lapRangeEnd}>–{windowEnd}</span>
          )}
        </StatChip>
      )}
    </div>
  );
});

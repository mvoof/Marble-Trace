import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import styles from './PitWarningHeader.module.scss';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { isPitNow } from '../../fuel-utils';

const NO_LAP_PLACEHOLDER = '--';

export const PitWarningHeader = observer(() => {
  const { fuel } = useBackendComputedStore();

  const windowStart = fuel?.pitWindowStart ?? null;
  const windowEnd = fuel?.pitWindowEnd ?? null;
  const isNow = isPitNow(fuel?.lapsRemaining ?? null);

  return (
    <div className={styles.pitWarningHeader}>
      <StatChip lead="PIT WINDOW" tone="accent" />

      {/* Once there is no lap left to name, the range gives way to a call
        louder than the range it stands in for. */}
      {isNow ? (
        <StatChip lead="PIT NOW" leadVariant="solid" tone="danger" />
      ) : (
        <StatChip lead="LAP" tone="muted" className={styles.lapChip}>
          {windowStart ?? NO_LAP_PLACEHOLDER}

          {windowEnd !== null && (
            <span className={styles.lapRangeEnd}>–{windowEnd}</span>
          )}
        </StatChip>
      )}
    </div>
  );
});

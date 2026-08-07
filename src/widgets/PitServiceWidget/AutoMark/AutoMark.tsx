import { observer } from 'mobx-react-lite';

import styles from './AutoMark.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

const MARK_LABEL = 'A';

interface AutoMarkProps {
  /** Whether auto mode is set to order this particular thing. */
  enabled: boolean;
}

/**
 * Marks a block auto mode owns — fuel and tires are switched separately, so
 * each says so for itself instead of one badge in the header standing for both.
 * Dimmed while the stop is suspended: auto is configured, but this stop is the
 * driver's.
 */
export const AutoMark = observer(({ enabled }: AutoMarkProps) => {
  const pitService = usePitServiceWidgetStore();

  if (!enabled) {
    return null;
  }

  return (
    <span
      title="Ordered by auto mode"
      className={
        pitService.isAutoActive ? styles.markActive : styles.markSuspended
      }
    >
      {MARK_LABEL}
    </span>
  );
});

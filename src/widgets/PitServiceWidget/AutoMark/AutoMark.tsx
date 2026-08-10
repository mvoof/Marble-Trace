import { observer } from 'mobx-react-lite';

import styles from './AutoMark.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

const MARK_LABEL = 'A';

interface AutoMarkProps {
  /** Whether auto mode is set to order this particular thing. */
  enabled: boolean;
  /** Which half of the order the badge stands for. */
  section: 'fuel' | 'tires';
}

/**
 * Marks a block auto mode owns — fuel and tires are switched separately, so
 * each says so for itself instead of one badge in the header standing for both.
 * Dimmed once this half is no longer auto mode's to decide: the whole stop was
 * handed to the driver, or the driver took this half over by hand.
 */
export const AutoMark = observer(({ enabled, section }: AutoMarkProps) => {
  const pitService = usePitServiceWidgetStore();

  if (!enabled) {
    return null;
  }

  const pending =
    section === 'fuel'
      ? pitService.isAutoFuelPending
      : pitService.isAutoTiresPending;

  return (
    <span
      title={pending ? 'Ordered by auto mode' : 'Taken over for this stop'}
      className={pending ? styles.markActive : styles.markSuspended}
    >
      {MARK_LABEL}
    </span>
  );
});

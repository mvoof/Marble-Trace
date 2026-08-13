import { observer } from 'mobx-react-lite';

import styles from './CompoundRow.module.scss';
import { usePitServiceWidgetStore } from '@store/root-store-context';

const UNKNOWN_COMPOUND = '—';

/**
 * The compound on the pit order. Rendered only for cars that actually have a
 * choice — a row that can only ever say one thing is a row worth its space back.
 */
export const CompoundRow = observer(() => {
  const pitService = usePitServiceWidgetStore();

  if (!pitService.order.hasCompoundChoice) {
    return null;
  }

  const name = pitService.order.orderedCompoundName ?? UNKNOWN_COMPOUND;

  const content = (
    <>
      <span className={styles.label}>COMPOUND</span>

      <span className={styles.value}>{name}</span>
    </>
  );

  if (!pitService.order.canClickOrders) {
    return <div className={styles.compound}>{content}</div>;
  }

  return (
    <button
      type="button"
      aria-label="Tire compound on the pit order: click to step to the next one"
      className={`${styles.compound} ${styles.compoundClickable}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => void pitService.order.cycleTireCompound()}
    >
      {content}
    </button>
  );
});

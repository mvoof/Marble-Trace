import { observer } from 'mobx-react-lite';

import styles from './OrderChips.module.scss';
import { OrderToggle } from '@ui/widgets/PitServiceWidget/OrderToggle/OrderToggle';
import {
  usePitServiceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';

const UNKNOWN_COMPOUND = '—';

/**
 * The three small orders in one row: fast repair, windshield, compound. Each was
 * a block of its own before, which spent three rows on values two characters
 * wide. They keep their words rather than taking icons — the row is wide enough
 * for them, and a guessed pictogram for "windshield" is a worse label.
 */
export const OrderChips = observer(() => {
  const widget = usePitServiceWidgetStore();
  const { pitService } = usePlayerStore();

  const available = pitService?.fastRepairsAvailable ?? 0;
  const used = pitService?.fastRepairsUsed ?? 0;

  return (
    <div className={styles.chips}>
      {/*
        Both toggles are shown whether or not they are ordered — in interact
        mode they double as the click target, and a control that appears only
        once it is on cannot be turned on.
      */}
      <OrderToggle
        className={`${styles.chip} ${widget.order.isFastRepairOrdered ? styles.chipOrdered : ''}`}
        clickableClassName={styles.chipClickable}
        label="Toggle fast repair"
        onToggle={() => void widget.order.toggleFastRepair()}
      >
        <span className={styles.label}>FAST REP</span>

        <span className={styles.value}>
          {used} / {available + used}
        </span>
      </OrderToggle>

      <OrderToggle
        className={`${styles.chip} ${widget.order.isWindshieldOrdered ? styles.chipOrdered : ''}`}
        clickableClassName={styles.chipClickable}
        label="Toggle windshield clean"
        onToggle={() => void widget.order.toggleWindshield()}
      >
        <span className={styles.label}>WINDSHIELD</span>
      </OrderToggle>

      {/*
        Rendered only for cars that actually have a choice — a chip that can only
        ever say one thing is a chip worth its space back.
      */}
      {widget.order.hasCompoundChoice && (
        <OrderToggle
          className={styles.chip}
          clickableClassName={styles.chipClickable}
          label="Tire compound on the pit order: click to step to the next one"
          onToggle={() => void widget.order.cycleTireCompound()}
        >
          <span className={styles.value}>
            {widget.order.orderedCompoundName ?? UNKNOWN_COMPOUND}
          </span>
        </OrderToggle>
      )}
    </div>
  );
});

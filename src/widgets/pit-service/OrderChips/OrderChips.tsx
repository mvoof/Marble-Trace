import { observer } from 'mobx-react-lite';

import { StatChip } from '@shared/ui/StatChip/StatChip';
import styles from './OrderChips.module.scss';
import { OrderToggle } from '@widgets/pit-service/OrderToggle/OrderToggle';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';
import { usePlayerStore } from '@entities/player/player-context';

const UNKNOWN_COMPOUND = '—';

// The compound is named in the color the standings give its badge: white for
// hard, blue for wet.
const COMPOUND_CLASS: Record<string, string> = {
  S: styles.compoundSoft,
  M: styles.compoundMedium,
  H: styles.compoundHard,
  W: styles.compoundWet,
};

const compoundClass = (name: string | null): string =>
  name === null
    ? ''
    : (COMPOUND_CLASS[name.charAt(0).toUpperCase()] ?? styles.compoundMedium);

/**
 * The three small orders in one row: fast repair, windshield, compound. They
 * keep their words rather than taking icons — the row is wide enough for them,
 * and a guessed pictogram for "windshield" is a worse label.
 */
export const OrderChips = observer(() => {
  const widget = usePitServiceWidgetStore();
  const { pitService } = usePlayerStore();

  const available = pitService?.fastRepairsAvailable ?? 0;
  const used = pitService?.fastRepairsUsed ?? 0;
  const isFastRepairOrdered = widget.order.isFastRepairOrdered;
  const isWindshieldOrdered = widget.order.isWindshieldOrdered;
  const compoundName = widget.order.orderedCompoundName;

  return (
    <div className={styles.chips}>
      {/*
        Both toggles are shown whether or not they are ordered — in interact
        mode they double as the click target, and a control that appears only
        once it is on cannot be turned on.
      */}
      <OrderToggle
        className={styles.toggle}
        clickableClassName={styles.toggleClickable}
        label="Toggle fast repair"
        onToggle={() => widget.order.toggleFastRepair()}
      >
        <StatChip
          lead="FAST REP"
          tone={isFastRepairOrdered ? 'positive' : 'muted'}
          emphasized={isFastRepairOrdered}
        >
          {used}/{available + used}
        </StatChip>
      </OrderToggle>

      <OrderToggle
        className={styles.toggle}
        clickableClassName={styles.toggleClickable}
        label="Toggle windshield clean"
        onToggle={() => widget.order.toggleWindshield()}
      >
        <StatChip
          lead="WINDSHIELD"
          tone={isWindshieldOrdered ? 'positive' : 'muted'}
        />
      </OrderToggle>

      {/*
        Rendered only for cars that actually have a choice — a chip that can only
        ever say one thing is a chip worth its space back.
      */}
      {widget.order.hasCompoundChoice && (
        <OrderToggle
          className={styles.toggle}
          clickableClassName={styles.toggleClickable}
          label="Tire compound on the pit order: click to step to the next one"
          onToggle={() => widget.order.cycleTireCompound()}
        >
          <StatChip
            lead={compoundName ?? UNKNOWN_COMPOUND}
            className={compoundClass(compoundName)}
          />
        </OrderToggle>
      )}
    </div>
  );
});

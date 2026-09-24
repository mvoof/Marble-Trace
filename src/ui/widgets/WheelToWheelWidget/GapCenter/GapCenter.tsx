import { observer } from 'mobx-react-lite';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { FixedDigits } from '@ui/shared/FixedDigits/FixedDigits';
import type { RivalSlot } from '../wheel-to-wheel.widget';

import styles from './GapCenter.module.scss';

// Overlay text is English in every locale, like every other widget's.
const TITLE = 'Wheel to Wheel';
const CAPTION = 'Gap';

/**
 * The gap, or both gaps: with a rival on each side the centre stacks them the
 * way the right half stacks the cars, so each number sits level with its car.
 */
export const GapCenter = observer(() => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  if (wheelToWheel.isSplit) {
    return (
      <div className={styles.center}>
        <span className={styles.title}>{TITLE}</span>
        <GapReadout slot="ahead" compact />
        <GapReadout slot="behind" compact />
      </div>
    );
  }

  return (
    <div className={styles.center}>
      <span className={styles.title}>{TITLE}</span>

      <div className={styles.gapRow}>
        <ChevronLeft className={styles.chevronPlayer} strokeWidth={3} />
        <GapReadout slot={wheelToWheel.singleSlot} />
        <ChevronRight className={styles.chevronRival} strokeWidth={3} />
      </div>

      <span className={styles.caption}>{CAPTION}</span>
    </div>
  );
});

interface GapReadoutProps {
  slot: RivalSlot;
  compact?: boolean;
}

/** The only part of the centre that moves, so the only part that re-renders. */
const GapReadout = observer(({ slot, compact }: GapReadoutProps) => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  return (
    <span className={`${styles.gap} ${compact ? styles.gapCompact : ''}`}>
      <FixedDigits
        className={styles.gapValue}
        text={wheelToWheel.slots[slot].gapText}
      />
      <span className={styles.gapUnit}>s</span>
    </span>
  );
});

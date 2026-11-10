import { observer } from 'mobx-react-lite';
import { useRef } from 'react';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { formatSpeed } from '@shared/lib/telemetry-format';
import { writeStatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { useDrivingCoachWidgetStore } from '@widgets/coach/coach-stores';
import { NO_SPEED_GAP, settleSpeedGap, type ShownSpeedGap } from './speed-gap';

import styles from './SpeedGapChip.module.scss';

const NO_VALUE_TEXT = '—';
const EVEN_TEXT = '0';

const speedGapText = (shown: ShownSpeedGap): string => {
  if (shown.kind === 'none') {
    return NO_VALUE_TEXT;
  }

  if (shown.kind === 'even') {
    return EVEN_TEXT;
  }

  const sign = shown.units > 0 ? '+' : '−';

  return `${sign}${Math.abs(shown.units)}`;
};

const speedGapTone = (shown: ShownSpeedGap): StatChipTone => {
  if (shown.kind !== 'gap') {
    return 'muted';
  }

  return shown.units > 0 ? 'positive' : 'danger';
};

/**
 * How far off the reference's speed this lap is at the car's position, as a
 * quiet chip. It moves with the car, so it is written straight to the chip. It
 * is the gap of the two figures as the footer shows them, so the three add up
 * — except near zero, where a unit either way is rounding and the chip holds
 * at an even 0 (`settleSpeedGap`).
 */
export const SpeedGapChip = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();

  const shownRef = useRef<ShownSpeedGap>(NO_SPEED_GAP);

  const chipRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const referenceSpeedMps = coach.referenceSpeedMps;
      const gap =
        referenceSpeedMps === null
          ? null
          : Number(formatSpeed(coach.currentSpeedMps, units.unitSystem)) -
            Number(formatSpeed(referenceSpeedMps, units.unitSystem));
      const shown = settleSpeedGap(shownRef.current, gap);

      shownRef.current = shown;

      const tone = speedGapTone(shown);
      const text = speedGapText(shown);

      scheduleWrite(() => {
        writeStatChip(element, tone, 'number', text, 'reading');
      });
    },
    [coach, units]
  );

  return (
    <span className={styles.root}>
      <span ref={chipRef} />
    </span>
  );
});

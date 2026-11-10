import { observer } from 'mobx-react-lite';

import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { formatSpeed } from '@shared/lib/telemetry-format';
import { writeStatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { useDrivingCoachWidgetStore } from '@widgets/coach/coach-stores';

import styles from './SpeedGapChip.module.scss';

const NO_VALUE_TEXT = '—';

/** How far this lap's speed is off the reference's here, in whole display units. */
const speedGapText = (gap: number | null): string => {
  if (gap === null) {
    return NO_VALUE_TEXT;
  }

  const sign = gap > 0 ? '+' : gap < 0 ? '−' : '';

  return `${sign}${Math.abs(gap)}`;
};

const speedGapTone = (gap: number | null): StatChipTone => {
  if (gap === null || gap === 0) {
    return 'muted';
  }

  return gap > 0 ? 'positive' : 'danger';
};

/**
 * How far off the reference's speed this lap is at the car's position, as a
 * quiet chip. It moves with the car, so it is written straight to the chip. It
 * is the gap of the two figures as the footer shows them, so the three always
 * add up.
 */
export const SpeedGapChip = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const units = useUnitsStore();

  const chipRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const referenceSpeedMps = coach.referenceSpeedMps;
      const gap =
        referenceSpeedMps === null
          ? null
          : Number(formatSpeed(coach.currentSpeedMps, units.unitSystem)) -
            Number(formatSpeed(referenceSpeedMps, units.unitSystem));
      const tone = speedGapTone(gap);
      const text = speedGapText(gap);

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

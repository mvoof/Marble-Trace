import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { FlagType } from '@shared/contracts/domain';
import { useBlink, type BlinkCycle } from '@shared/hooks/useBlink';
import { FLAG_BLINK } from '@entities/flags/flag-blink';
import { getSingleLedColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';
import { useFlagsStore } from '@entities/flags/flags-context';
import type { LedFlagsSettings } from '@entities/flags/flag-display.settings-schema';

/** The animated light: lit and dark half a second each. */
const LED_BLINK: BlinkCycle = { stepMs: 500, steps: 2 };

/** White breathes slower: a second lit, a second half dark. */
const WHITE_BREATH: BlinkCycle = { stepMs: 1000, steps: 2 };

/** DQ double-blinks: six 200 ms steps, lit on the first and the third. */
const DQ_DOUBLE_BLINK: BlinkCycle = { stepMs: 200, steps: 6 };

// Without the animation only a yellow or a red still flashes, in step with the
// other flag widgets.
const blinkCycleFor = (flag: FlagType, animate: boolean): BlinkCycle | null => {
  if (!animate) {
    return flag === 'yellow' || flag === 'red' ? FLAG_BLINK : null;
  }

  if (flag === 'white') {
    return WHITE_BREATH;
  }

  if (flag === 'dq') {
    return DQ_DOUBLE_BLINK;
  }

  return LED_BLINK;
};

export const SingleLed = observer(() => {
  const flags = useFlagsStore();

  const { alwaysShow, animate } =
    useWidgetSettings<LedFlagsSettings>('led-flags');

  const { ledDisplayFlag: flag } = flags;

  const colorClass = getSingleLedColorClass(
    flag,
    styles as unknown as ColorStyles
  );

  const blinkRef = useBlink<HTMLDivElement>(
    colorClass === '' ? null : blinkCycleFor(flag, animate)
  );

  if (!alwaysShow && flag === 'none') {
    return null;
  }

  return (
    <div className={styles.singleLed}>
      <div
        ref={blinkRef}
        className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
      />
    </div>
  );
});

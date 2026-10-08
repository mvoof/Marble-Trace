import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { getSingleLedColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';
import { useFlagsStore } from '@entities/flags/flags-context';
import type { LedFlagsSettings } from '@entities/flags/flag-display.settings-schema';

export const SingleLed = observer(() => {
  const flags = useFlagsStore();

  const { alwaysShow, animate } =
    useWidgetSettings<LedFlagsSettings>('led-flags');

  const { ledDisplayFlag: flag, blinkOn } = flags;

  if (!alwaysShow && flag === 'none') {
    return null;
  }

  const isOff =
    flag === 'none' ||
    (!animate && (flag === 'yellow' || flag === 'red') && !blinkOn);

  const colorClass = isOff
    ? ''
    : getSingleLedColorClass(flag, styles as unknown as ColorStyles);

  return (
    <div
      className={`${styles.singleLed}${animate ? ` ${styles.animate}` : ''}`}
    >
      <div
        className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
      />
    </div>
  );
});

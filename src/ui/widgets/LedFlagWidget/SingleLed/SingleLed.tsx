import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { getSingleLedColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';
import type { FlagDisplaySettings } from '@/types/widget-settings';
import { useFlagsStore } from '@store/root-store-context';

export const SingleLed = observer(() => {
  const flags = useFlagsStore();

  const { alwaysShow, animate } =
    useWidgetSettings<FlagDisplaySettings>('led-flags');

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

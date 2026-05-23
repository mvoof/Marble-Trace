import { observer } from 'mobx-react-lite';

import { getSingleLedColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';
import type { FlagDisplaySettings } from '@/types/widget-settings';
import {
  useFlagsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const SingleLed = observer(() => {
  const flags = useFlagsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { alwaysShow } =
    widgetSettings.getSettings<FlagDisplaySettings>('led-flags');

  const { ledDisplayFlag: flag, blinkOn } = flags;

  if (!alwaysShow && flag === 'none') {
    return null;
  }

  const isOff =
    flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

  const colorClass = isOff
    ? ''
    : getSingleLedColorClass(flag, styles as unknown as ColorStyles);

  return (
    <div className={styles.singleLed}>
      <div
        className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
      />
    </div>
  );
});

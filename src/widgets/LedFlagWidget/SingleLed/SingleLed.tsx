import { observer } from 'mobx-react-lite';

import { getSingleLedColorClass, type ColorStyles } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';
import {
  useFlagsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

interface SingleLedProps {
  blinkOn: boolean;
}

export const SingleLed = observer(({ blinkOn }: SingleLedProps) => {
  const flags = useFlagsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { alwaysShow } = widgetSettings.getFlagDisplaySettings('led-flags');

  const flag = flags.ledDisplayFlag;

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

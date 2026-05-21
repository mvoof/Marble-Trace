import { observer } from 'mobx-react-lite';

import { flagsStore } from '@store/flags.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { getSingleLedColorClass } from '../led-matrix-utils';

import styles from './SingleLed.module.scss';

interface SingleLedProps {
  blinkOn: boolean;
}

export const SingleLed = observer(({ blinkOn }: SingleLedProps) => {
  const { alwaysShow } =
    widgetSettingsStore.getFlagDisplaySettings('led-flags');

  const flag = flagsStore.ledDisplayFlag;

  if (!alwaysShow && flag === 'none') {
    return null;
  }

  const isOff =
    flag === 'none' || ((flag === 'yellow' || flag === 'red') && !blinkOn);

  const colorClass = isOff ? '' : getSingleLedColorClass(flag);

  return (
    <div className={styles.singleLed}>
      <div
        className={`${styles.singleLedInner}${colorClass ? ` ${colorClass}` : ''}`}
      />
    </div>
  );
});

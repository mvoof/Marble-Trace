import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { ShiftDigit } from '@entities/player/readouts/ShiftDigit';
import { rpmDigitColorsOf } from '@shared/lib/car-signals';

import type { InvisibleDashWidgetSettings } from '../settings-schema';
import styles from './GearReadout.module.scss';

/** The gear, painted by the rev zone and flashing at the shift point. */
export const GearReadout = observer(() => {
  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  if (!settings.showGear) {
    return null;
  }

  return (
    <ShiftDigit
      format="gear"
      zoneColors={
        settings.colorizeGearByZone ? rpmDigitColorsOf(settings) : null
      }
      blink={settings.blinkAtShift}
      className={styles.gear}
    />
  );
});

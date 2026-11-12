import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { ShiftDigit } from '@entities/player/readouts/ShiftDigit';
import { rpmDigitColorsOf } from '@shared/lib/car-signals';

import type { RaceDashWidgetSettings } from '../settings-schema';
import styles from './RpmValue.module.scss';

/** The rev counter's own number, painted by the rev zone. */
export const RpmValue = observer(() => {
  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  // The number flashes only while it is tinted: a white number flashing
  // beside a ring that already does would say the same thing twice.
  return (
    <ShiftDigit
      format="rpm"
      zoneColors={
        settings.colorizeByRpmZone ? rpmDigitColorsOf(settings) : null
      }
      blink={settings.blinkAtShift && settings.colorizeByRpmZone}
      className={styles.value}
    />
  );
});

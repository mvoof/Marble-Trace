import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState } from '@utils/car-signals';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';

import { formatGear, zoneDigitColor } from '../invisible-dash-utils';

import styles from './GearReadout.module.scss';

const GEAR_COLOR_PROPERTY = '--dash-gear-color';

/**
 * The gear, and the zone colour it is painted in. The gear changes with the
 * shift and the zone with the revs, both off the 60 Hz dynamics frame, so both
 * are written straight to the digit. See `docs/rendering.md`.
 */
export const GearReadout = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const gearRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const gear = player.carDynamics?.gear ?? 0;
      const { zone } = computeRpmZoneState(
        // oxlint-disable-next-line no-restricted-properties
        Math.round(player.carDynamics?.rpm ?? 0),
        sessionStore.sessionInfo,
        player.carStatus,
        gear
      );

      const gearColor = settings.colorizeGearByZone
        ? zoneDigitColor(zone, settings)
        : null;

      const gearText = formatGear(gear);

      scheduleWrite(() => {
        element.style.setProperty(GEAR_COLOR_PROPERTY, gearColor ?? '');
        element.textContent = gearText;
      });
    },
    [player, sessionStore, settings]
  );

  if (!settings.showGear) {
    return null;
  }

  return <span ref={gearRef} className={styles.gear} />;
});

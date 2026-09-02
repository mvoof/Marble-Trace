import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState } from '@utils/car-signals';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';

import { formatGear, zoneDigitColor } from '../invisible-dash-utils';

import styles from './GearReadout.module.scss';

export const GearReadout = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  if (!settings.showGear) {
    return null;
  }

  const gear = carDynamics?.gear ?? 0;
  const { zone } = computeRpmZoneState(
    Math.round(carDynamics?.rpm ?? 0),
    sessionInfo,
    carStatus,
    gear
  );

  const gearColor = settings.colorizeGearByZone
    ? zoneDigitColor(zone, settings)
    : null;

  return (
    <span
      className={styles.gear}
      style={gearColor ? { color: gearColor } : undefined}
    >
      {formatGear(gear)}
    </span>
  );
});

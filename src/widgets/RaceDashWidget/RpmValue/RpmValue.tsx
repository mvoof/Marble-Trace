import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState, rpmNumberColor } from '../race-dash-utils';
import {
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './RpmValue.module.scss';

export const RpmValue = observer(() => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const rpm = Math.round(carDynamics?.rpm ?? 0);
  const gear = carDynamics?.gear ?? 0;
  const { zone } = computeRpmZoneState(rpm, sessionInfo, carStatus, gear);
  const zoneColor = rpmNumberColor(zone, settings);
  const isBlink = zoneColor !== null && zone === 'blink';

  return (
    <span
      className={`${styles.value} ${isBlink ? styles.blinkPulse : ''}`}
      style={zoneColor ? { color: zoneColor } : undefined}
    >
      {rpm}
    </span>
  );
});

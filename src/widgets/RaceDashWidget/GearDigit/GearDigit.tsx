import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { formatGear } from '@utils/formatters/telemetry-format';
import { computeRpmZoneState, rpmNumberColor } from '../race-dash-utils';
import {
  usePlayerStore,
  useSessionStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './GearDigit.module.scss';

interface GearDigitProps {
  /** track = compact digit beside the speed; pit = large centered digit. */
  variant: 'track' | 'pit';
}

export const GearDigit = observer(({ variant }: GearDigitProps) => {
  const { carDynamics, carStatus } = usePlayerStore();
  const { sessionInfo } = useSessionStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const gear = carDynamics?.gear ?? 0;
  const rpm = carDynamics?.rpm ?? 0;

  const { zone } = computeRpmZoneState(rpm, sessionInfo, carStatus);
  const zoneColor = variant === 'track' ? rpmNumberColor(zone, settings) : null;
  const isBlink = zoneColor !== null && zone === 'blink';

  return (
    <div className={variant === 'pit' ? styles.pit : styles.track}>
      <span
        className={`${styles.digit} ${isBlink ? styles.blinkPulse : ''}`}
        style={zoneColor ? { color: zoneColor } : undefined}
      >
        {formatGear(gear)}
      </span>

      <span className={styles.label}>GEAR</span>
    </div>
  );
});

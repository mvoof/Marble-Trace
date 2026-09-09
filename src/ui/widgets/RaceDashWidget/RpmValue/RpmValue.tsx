import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState, rpmNumberColor } from '../race-dash-utils';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';

import styles from './RpmValue.module.scss';

const RPM_COLOR_PROPERTY = '--rpm-value-color';

/**
 * The rev counter's own number. Revs change on every physics tick, so the digits,
 * the zone colour and the redline pulse are written straight to the span. See
 * `docs/rendering.md`.
 */
export const RpmValue = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings = useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const valueRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      // oxlint-disable-next-line no-restricted-properties
      const rpm = Math.round(player.carDynamics?.rpm ?? 0);
      const { zone } = computeRpmZoneState(
        rpm,
        sessionStore.sessionInfo,
        player.carStatus,
        // oxlint-disable-next-line no-restricted-properties
        player.carDynamics?.gear ?? 0
      );

      const zoneColor = rpmNumberColor(zone, settings);
      const isBlink = zoneColor !== null && zone === 'blink';

      scheduleWrite(() => {
        element.style.setProperty(RPM_COLOR_PROPERTY, zoneColor ?? '');
        element.classList.toggle(styles.blinkPulse, isBlink);
        element.textContent = String(rpm);
      });
    },
    [player, sessionStore, settings]
  );

  return <span ref={valueRef} className={styles.value} />;
});

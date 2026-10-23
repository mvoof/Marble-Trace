import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { computeRpmZoneState } from '../race-dash-utils';
import {
  REDLINE_BLINK,
  rpmDigitColorsOf,
  shiftDigitState,
} from '@shared/lib/car-signals';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useBlinkHandle } from '@shared/hooks/useBlink';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';

import styles from './RpmValue.module.scss';
import type { RaceDashWidgetSettings } from '../settings-schema';

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
  const redlineBlink = useBlinkHandle();

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

      // The number flashes only while it is tinted: a white number flashing
      // beside a ring that already does would say the same thing twice.
      const { color: zoneColor, isBlink } = shiftDigitState(zone, {
        colors: settings.colorizeByRpmZone ? rpmDigitColorsOf(settings) : null,
        blink: settings.blinkAtShift && settings.colorizeByRpmZone,
      });

      scheduleWrite(() => {
        element.style.setProperty(RPM_COLOR_PROPERTY, zoneColor ?? '');
        element.classList.toggle(styles.blinkPulse, isBlink);
        redlineBlink.attach(element);
        redlineBlink.run(isBlink ? REDLINE_BLINK : null);
        element.textContent = String(rpm);
      });
    },
    [player, sessionStore, settings, redlineBlink]
  );

  return <span ref={valueRef} className={styles.value} />;
});

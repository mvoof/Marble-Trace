import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@shared/contracts/widget-settings';
import { computeRpmZoneState } from '@shared/lib/car-signals';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { usePlayerStore } from '@entities/player/player-context';
import { useSessionStore } from '@entities/session/session-context';

import { shiftBarColor } from '../invisible-dash-utils';

import styles from './ShiftBar.module.scss';

const FULL_PERCENT = 100;

const FILL_RIGHT_PROPERTY = '--shift-fill-right';
const FILL_COLOR_PROPERTY = '--shift-fill-color';

/**
 * The revs as a bar. It follows the engine on every physics tick, so its width
 * and its colour are written straight to the DOM rather than rendered. See
 * `docs/rendering.md`.
 */
export const ShiftBar = observer(() => {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const trackRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const { pct, zone } = computeRpmZoneState(
        // oxlint-disable-next-line no-restricted-properties
        Math.round(player.carDynamics?.rpm ?? 0),
        sessionStore.sessionInfo,
        player.carStatus,
        // oxlint-disable-next-line no-restricted-properties
        player.carDynamics?.gear ?? 0
      );

      const color = shiftBarColor(zone, settings);

      scheduleWrite(() => {
        element.style.setProperty(
          FILL_RIGHT_PROPERTY,
          `${FULL_PERCENT - pct * FULL_PERCENT}%`
        );
        element.style.setProperty(FILL_COLOR_PROPERTY, color);
      });
    },
    [player, sessionStore, settings]
  );

  return (
    <span ref={trackRef} className={styles.track}>
      <i className={styles.fill} />
    </span>
  );
});

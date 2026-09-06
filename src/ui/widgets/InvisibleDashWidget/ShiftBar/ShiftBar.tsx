import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState } from '@utils/car-signals';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import { usePlayerStore, useSessionStore } from '@store/root-store-context';

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
export const ShiftBar = observer(function ShiftBar() {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const trackRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const { pct, zone } = computeRpmZoneState(
        Math.round(player.carDynamics?.rpm ?? 0),
        sessionStore.sessionInfo,
        player.carStatus,
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

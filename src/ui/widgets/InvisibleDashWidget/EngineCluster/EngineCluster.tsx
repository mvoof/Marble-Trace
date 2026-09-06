import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { InvisibleDashWidgetSettings } from '@/types/widget-settings';
import { computeRpmZoneState } from '@utils/car-signals';
import { formatSpeed, speedUnit } from '@utils/telemetry-format';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  usePlayerStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import { zoneDigitColor } from '../invisible-dash-utils';
import { ShiftBar } from '../ShiftBar/ShiftBar';

import styles from './EngineCluster.module.scss';

const RPM_PERCENT_BASE = 100;

const RPM_COLOR_PROPERTY = '--dash-rpm-color';

/**
 * The revs and the speed. Both move on every physics tick, so the cluster is
 * markup React renders once and a single pass per animation frame fills. See
 * `docs/rendering.md`.
 */
export const EngineCluster = observer(function EngineCluster() {
  const player = usePlayerStore();
  const sessionStore = useSessionStore();
  const units = useUnitsStore();

  const settings =
    useWidgetSettings<InvisibleDashWidgetSettings>('invisible-dash');

  const rootRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const rpm = Math.round(player.carDynamics?.rpm ?? 0);
      const { pct, zone } = computeRpmZoneState(
        rpm,
        sessionStore.sessionInfo,
        player.carStatus,
        player.carDynamics?.gear ?? 0
      );

      const rpmText =
        settings.rpmFormat === 'percent'
          ? `${Math.round(pct * RPM_PERCENT_BASE)}%`
          : String(rpm);

      const rpmColor = settings.colorizeRpmByZone
        ? zoneDigitColor(zone, settings)
        : null;

      const speedText = formatSpeed(
        player.carDynamics?.speed ?? 0,
        units.unitSystem
      );

      scheduleWrite(() => {
        element.style.setProperty(RPM_COLOR_PROPERTY, rpmColor ?? '');

        const rpmValue = element.querySelector(`.${styles.rpm}`);

        if (rpmValue instanceof HTMLElement) {
          rpmValue.textContent = rpmText;
        }

        const speedValue = element.querySelector(`.${styles.speed}`);

        if (speedValue instanceof HTMLElement) {
          speedValue.textContent = speedText;
        }
      });
    },
    [player, sessionStore, units, settings]
  );

  if (!settings.showSpeed && !settings.showRpm && !settings.showShiftBar) {
    return null;
  }

  return (
    <div ref={rootRef} className={styles.root}>
      {settings.showShiftBar && <ShiftBar />}

      {settings.showRpm && (
        <div className={styles.row}>
          <span className={styles.rpm} />

          <span className={styles.caption}>RPM</span>
        </div>
      )}

      {settings.showSpeed && (
        <div className={styles.row}>
          <span className={styles.speed} />

          <span className={styles.unit}>{speedUnit(units.unitSystem)}</span>
        </div>
      )}
    </div>
  );
});

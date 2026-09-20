import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePlayerStore } from '@store/root-store-context';
import type { BatteryWidgetSettings } from '@/types/widget-settings';
import { ChargeRow } from './ChargeRow';
import { DeployModeStrip } from './DeployModeStrip';
import { StatusRow } from './StatusRow';
import { deployModeIndex } from './battery-utils';
import styles from './BatteryWidget.module.scss';

/**
 * The hybrid battery: how much is left, what the MGU-K is doing with it, and on
 * the cars that have a selector, which deploy mode it is doing it in.
 *
 * Everything here rides the 4 Hz `carStatus` frame, so the orchestrator reads it
 * directly — none of these fields is on a hot tier and none is demand-gated.
 *
 * The widget draws nothing at all on a car without a hybrid system. The adapter
 * clears an undeclared field rather than letting it read back as a default, so a
 * null charge means "no battery", not "a flat one".
 */
export const BatteryWidget = observer(() => {
  const { carStatus } = usePlayerStore();
  const settings = useWidgetSettings<BatteryWidgetSettings>('battery');

  if (carStatus?.energy_ers_battery_pct == null) {
    return null;
  }

  // Compact mode strips the widget down to the charge itself — nothing else
  // gets a look-in, whatever the other toggles say.
  const compact = settings.compactMode;

  // A car that parks the mode on one value it never moves (the GTP cars do)
  // has no selector to mirror, so the strip is left out rather than drawn as a
  // control the driver cannot reach.
  const showModeStrip =
    !compact &&
    settings.showDeployMode &&
    deployModeIndex(carStatus.dc_mguk_deploy_mode ?? null) !== null;

  const showPower =
    !compact && settings.showPower && carStatus.power_mgu_k != null;

  const showLapDeploy =
    !compact &&
    settings.showLapDeploy &&
    carStatus.energy_battery_to_mgu_k_lap != null;

  const showStatusRow = showPower || showLapDeploy;

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.root}
    >
      <div className={styles.chargeBlock}>
        <ChargeRow />
      </div>

      {showModeStrip ? (
        <div className={styles.section}>
          <DeployModeStrip />
        </div>
      ) : null}

      {showStatusRow ? (
        <div className={styles.section}>
          <StatusRow showPower={showPower} showLapDeploy={showLapDeploy} />
        </div>
      ) : null}
    </WidgetPanel>
  );
});

import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePlayerStore } from '@store/root-store-context';
import type { BatteryWidgetSettings } from '@/types/widget-settings';
import { ChargeRow } from './ChargeRow';
import { ChargeBar } from './ChargeBar';
import { DeployModeStrip } from './DeployModeStrip';
import { PowerRow } from './PowerRow';
import { LapDeployRow } from './LapDeployRow';
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

  // A car that parks the mode on one value it never moves (the GTP cars do)
  // has no selector to mirror, so the strip is left out rather than drawn as a
  // control the driver cannot reach.
  const showModeStrip =
    settings.showDeployMode &&
    deployModeIndex(carStatus.dc_mguk_deploy_mode ?? null) !== null;

  const showPower = settings.showPower && carStatus.power_mgu_k != null;

  const showLapDeploy =
    settings.showLapDeploy && carStatus.energy_battery_to_mgu_k_lap != null;

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      minWidth={0}
      className={styles.root}
    >
      <ChargeRow />
      <ChargeBar />

      {showModeStrip ? <DeployModeStrip /> : null}

      {showPower ? <PowerRow /> : null}

      {showLapDeploy ? <LapDeployRow /> : null}
    </WidgetPanel>
  );
});

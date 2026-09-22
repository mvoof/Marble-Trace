import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import { DEPLOY_MODES, deployModeIndex } from './battery-utils';
import styles from './BatteryWidget.module.scss';

/**
 * The deploy-mode selector as a strip, so the driver reads the position rather
 * than the word. The parent decides whether the strip exists at all.
 */
export const DeployModeStrip = observer(() => {
  const { carStatus } = usePlayerStore();

  const active = deployModeIndex(carStatus?.dc_mguk_deploy_mode ?? null);

  return (
    <div className={styles.modeStrip}>
      {DEPLOY_MODES.map((mode, index) => (
        <div
          key={mode}
          className={`${styles.mode} ${index === active ? styles.modeActive : ''}`}
        >
          {mode}
        </div>
      ))}
    </div>
  );
});

import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@entities/player/player-context';
import { StatChip } from '@shared/ui/StatChip/StatChip';
import { DEPLOY_MODES, deployModeIndex } from './battery-utils';
import styles from './BatteryWidget.module.scss';

/**
 * The deploy-mode selector as a strip, so the driver reads the position rather
 * than the word. The active mode is the strip's one bright figure; the others
 * are bare text in the same slot. The parent decides whether the strip exists.
 */
export const DeployModeStrip = observer(() => {
  const { carStatus } = usePlayerStore();

  const active = deployModeIndex(carStatus?.dc_mguk_deploy_mode ?? null);

  return (
    <div className={styles.modeStrip}>
      {DEPLOY_MODES.map((mode, index) => (
        <div key={mode} className={styles.mode}>
          {index === active ? (
            <StatChip
              lead={mode}
              look="mark"
              tone="accent"
              className={styles.modeChip}
            />
          ) : (
            <span className={styles.modeText}>{mode}</span>
          )}
        </div>
      ))}
    </div>
  );
});

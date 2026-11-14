import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from './AppStatus.module.scss';
import { useSimStore } from '@entities/sim/sim-context';
import { getSimDisplayName } from '@app/windows/main/sim-name';

const IRACING_NAME = getSimDisplayName('IRacing');

export const AppStatus = observer(() => {
  const simStore = useSimStore();
  const { t } = useTranslation('main-app');

  const { status, error, currentSim, replayTape } = simStore;
  // The app runs on iRacing; before a sim is found its name is still the one
  // the driver is waiting for.
  const simName = currentSim ? getSimDisplayName(currentSim) : IRACING_NAME;

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        if (replayTape) {
          return {
            label: t('appStatus.replaying', { tape: replayTape }),
            dotClass: styles.connected,
            textClass: styles.connectedText,
          };
        }

        return {
          label: t('appStatus.connectedTo', {
            sim: simName,
          }),
          dotClass: styles.connected,
          textClass: styles.connectedText,
        };
      case 'waiting':
        if (currentSim) {
          return {
            label: t('appStatus.waitingForTelemetry', { sim: simName }),
            dotClass: styles.waiting,
            textClass: styles.waitingText,
          };
        }

        break;
      case 'error':
        return {
          label: error || t('appStatus.systemError'),
          dotClass: styles.error,
          textClass: styles.errorText,
        };
    }

    return {
      label: t('appStatus.waitingForGame', { sim: simName }),
      dotClass: styles.idle,
      textClass: styles.waitingText,
    };
  };

  const config = getStatusConfig();

  return (
    <div className={styles.container} title={config.label}>
      <span className={`${styles.dot} ${config.dotClass}`} />
      <span className={`${styles.label} ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
});

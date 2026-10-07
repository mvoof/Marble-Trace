import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from './AppStatus.module.scss';
import { useSimStore } from '@store/sim/sim-context';
import { getSimDisplayName } from '@ui/app/main/sim-name';

export const AppStatus = observer(() => {
  const simStore = useSimStore();
  const { t } = useTranslation('main-app');

  const { status, error, currentSim, replayTape } = simStore;

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
            sim: getSimDisplayName(currentSim).toUpperCase(),
          }),
          dotClass: styles.connected,
          textClass: styles.connectedText,
        };
      case 'waiting':
        if (currentSim) {
          return {
            label: t('appStatus.waitingForTelemetry'),
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
      label: t('appStatus.waitingForGame'),
      dotClass: styles.waiting,
      textClass: styles.waitingText,
    };
  };

  const config = getStatusConfig();

  return (
    <div className={styles.container}>
      <span className={`${styles.dot} ${config.dotClass}`} />
      <span className={`${styles.label} ${config.textClass}`}>
        {config.label}
      </span>
    </div>
  );
});

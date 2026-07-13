import { observer } from 'mobx-react-lite';
import styles from './AppStatus.module.scss';
import { useSimStore } from '@store/root-store-context';
import { getSimDisplayName } from '@utils/sim-name';

export const AppStatus = observer(() => {
  const simStore = useSimStore();

  const { status, error, currentSim } = simStore;

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: `CONNECTED TO ${getSimDisplayName(currentSim).toUpperCase()}`,
          dotClass: styles.connected,
          textClass: styles.connectedText,
        };
      case 'waiting':
        if (currentSim) {
          return {
            label: 'WAITING FOR TELEMETRY',
            dotClass: styles.waiting,
            textClass: styles.waitingText,
          };
        }

        break;
      case 'error':
        return {
          label: error || 'SYSTEM ERROR',
          dotClass: styles.error,
          textClass: styles.errorText,
        };
    }

    return {
      label: 'WAITING FOR GAME TO START',
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

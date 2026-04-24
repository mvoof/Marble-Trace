import { observer } from 'mobx-react-lite';
import { telemetryConnectionStore } from '../../../../store/iracing';
import styles from './AppStatus.module.scss';

export const AppStatus = observer(() => {
  const { status, error } = telemetryConnectionStore;

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'SYSTEM CONNECTED',
          dotClass: styles.connected,
          textClass: styles.connectedText,
        };
      case 'waiting':
        return {
          label: 'WAITING FOR IRACING',
          dotClass: styles.waiting,
          textClass: styles.waitingText,
        };
      case 'error':
        return {
          label: error || 'SYSTEM ERROR',
          dotClass: styles.error,
          textClass: styles.errorText,
        };
      case 'disconnected':
      default:
        return {
          label: 'IRACING NOT FOUND',
          dotClass: styles.disconnected,
          textClass: styles.disconnectedText,
        };
    }
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

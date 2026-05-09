import { Alert, Button } from 'antd';
import { observer } from 'mobx-react-lite';
import { appSettingsStore } from '../../../../store/app-settings.store';
import styles from './UpdateBanner.module.scss';

export const UpdateBanner = observer(() => {
  if (appSettingsStore.updateStatus !== 'available') return null;

  return (
    <Alert
      title={`Version v${appSettingsStore.availableVersion} is available`}
      type="info"
      showIcon
      closable
      action={
        <Button
          size="small"
          type="text"
          onClick={() => void appSettingsStore.installUpdate()}
        >
          Update & Restart
        </Button>
      }
      className={styles.alert}
    />
  );
});

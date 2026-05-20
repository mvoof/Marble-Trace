import { Alert, Button } from 'antd';
import { observer } from 'mobx-react-lite';
import {
  appSettingsStore,
  UpdateStatus,
} from '../../../../store/app-settings.store';
import { ReleaseNotesButton } from '../../../../app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import styles from './UpdateBanner.module.scss';

const BANNER_STATUSES: UpdateStatus[] = ['available', 'downloading', 'ready'];

const TITLES: Partial<Record<UpdateStatus, string>> = {
  available: `Version v${appSettingsStore.availableVersion} is available`,
  downloading: 'Downloading update...',
  ready: 'Update downloaded. Restarting...',
};

const ALERT_TYPES: Partial<
  Record<UpdateStatus, 'info' | 'success' | 'warning' | 'error'>
> = {
  available: 'info',
  downloading: 'info',
  ready: 'success',
};

export const UpdateBanner = observer(() => {
  const { updateStatus } = appSettingsStore;

  if (!BANNER_STATUSES.includes(updateStatus)) return null;

  const title =
    updateStatus === 'available'
      ? `Version v${appSettingsStore.availableVersion} is available`
      : TITLES[updateStatus];

  return (
    <Alert
      title={title}
      type={ALERT_TYPES[updateStatus] ?? 'info'}
      showIcon
      closable={
        updateStatus === 'available' ? { onClose: () => {} } : undefined
      }
      action={
        updateStatus === 'available' ? (
          <>
            <ReleaseNotesButton />
            <Button
              size="small"
              type="text"
              onClick={() => void appSettingsStore.installUpdate()}
            >
              Update & Restart
            </Button>
          </>
        ) : undefined
      }
      className={styles.alert}
    />
  );
});

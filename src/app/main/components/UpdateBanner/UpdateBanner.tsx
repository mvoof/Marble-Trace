import { Alert, Button } from 'antd';
import { observer } from 'mobx-react-lite';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import styles from './UpdateBanner.module.scss';
import { useAppSettingsStore } from '@store/root-store-context';
import { UpdateStatus } from '@store/settings/app-settings.store';

const BANNER_STATUSES: UpdateStatus[] = ['available', 'downloading', 'ready'];

const TITLES: Partial<Record<UpdateStatus, string>> = {
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
  const appSettings = useAppSettingsStore();

  const { updateStatus } = appSettings;

  if (!BANNER_STATUSES.includes(updateStatus)) return null;

  const title =
    updateStatus === 'available'
      ? `Version v${appSettings.availableVersion} is available`
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
              onClick={() => void appSettings.installUpdate()}
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

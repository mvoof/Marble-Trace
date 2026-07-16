import { Alert, Button } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import styles from './UpdateBanner.module.scss';
import { useAppSettingsStore } from '@store/root-store-context';
import { UpdateStatus } from '@store/settings/app-settings.store';

const BANNER_STATUSES: UpdateStatus[] = ['available', 'downloading', 'ready'];

const ALERT_TYPES: Partial<
  Record<UpdateStatus, 'info' | 'success' | 'warning' | 'error'>
> = {
  available: 'info',
  downloading: 'info',
  ready: 'success',
};

export const UpdateBanner = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  const { updateStatus } = appSettings;

  if (!BANNER_STATUSES.includes(updateStatus)) return null;

  const titles: Partial<Record<UpdateStatus, string>> = {
    downloading: t('updateBanner.downloading'),
    ready: t('updateBanner.ready'),
  };

  const title =
    updateStatus === 'available'
      ? t('updateBanner.available', { version: appSettings.availableVersion })
      : titles[updateStatus];

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
              {t('updateBanner.updateAndRestart')}
            </Button>
          </>
        ) : undefined
      }
      className={styles.alert}
    />
  );
});

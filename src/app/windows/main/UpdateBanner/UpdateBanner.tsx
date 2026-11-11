import { Alert, Button } from 'antd';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ReleaseNotesButton } from '@pages/settings/ReleaseNotesButton/ReleaseNotesButton';
import styles from './UpdateBanner.module.scss';
import { useAppUpdateStore } from '@features/app-update/app-update-context';
import type { UpdateStatus } from '@features/app-update/app-update.store';

const BANNER_STATUSES: UpdateStatus[] = ['available', 'downloading', 'ready'];

const ALERT_TYPES: Partial<
  Record<UpdateStatus, 'info' | 'success' | 'warning' | 'error'>
> = {
  available: 'info',
  downloading: 'info',
  ready: 'success',
};

export const UpdateBanner = observer(() => {
  const appUpdate = useAppUpdateStore();
  const { t } = useTranslation('main-app');

  const { status: updateStatus } = appUpdate;

  if (!BANNER_STATUSES.includes(updateStatus)) return null;

  const titles: Partial<Record<UpdateStatus, string>> = {
    downloading: t('updateBanner.downloading'),
    ready: t('updateBanner.ready'),
  };

  const title =
    updateStatus === 'available'
      ? t('updateBanner.available', { version: appUpdate.availableVersion })
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
              onClick={() => void appUpdate.installUpdate()}
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

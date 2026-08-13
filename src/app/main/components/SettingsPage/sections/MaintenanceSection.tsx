import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Popconfirm } from 'antd';
import { RotateCcw } from 'lucide-react';
import { downloadSnapshot } from '@app/main/capture-snapshot';
import { useAppSettingsStore, useStore } from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

const isDev = import.meta.env.DEV;

export const MaintenanceSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const store = useStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');

  const handleCaptureSnapshot = () => {
    downloadSnapshot(store, 'iracing');

    message.success(t('settingsPage.developerTools.snapshotSuccess'));
  };

  return (
    <>
      <SettingsCard title={t('settingsPage.reset.title')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                {t('settingsPage.reset.resetAllTitle')}
              </div>

              <div className={styles.fieldDesc}>
                {t('settingsPage.reset.resetAllDesc')}
              </div>
            </div>

            <Popconfirm
              title={t('settingsPage.reset.confirmTitle')}
              description={t('settingsPage.reset.confirmDescription')}
              okText={t('settingsPage.reset.confirmOk')}
              okButtonProps={{ danger: true }}
              cancelText={t('layoutEditor.cancel')}
              onConfirm={() => void appSettings.resetSettings()}
            >
              <Button danger icon={<RotateCcw size={16} />}>
                {t('settingsPage.reset.resetSettings')}
              </Button>
            </Popconfirm>
          </div>
        </div>
      </SettingsCard>

      {isDev && (
        <SettingsCard title={t('settingsPage.developerTools.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.developerTools.snapshotTitle')}
            </div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {t('settingsPage.developerTools.snapshotDesc')}
            </div>

            <Button block size="small" onClick={handleCaptureSnapshot}>
              {t('settingsPage.developerTools.downloadSnapshot')}
            </Button>
          </div>
        </SettingsCard>
      )}
    </>
  );
});

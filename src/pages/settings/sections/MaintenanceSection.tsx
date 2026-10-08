import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Popconfirm } from 'antd';
import { RotateCcw } from 'lucide-react';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useDiagnosticsExportStore } from '@features/diagnostics/diagnostics-export-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { FpsDiagnosticsCard } from '@features/diagnostics/FpsDiagnosticsCard/FpsDiagnosticsCard';
import { hasDevTools } from '../dev-tools';
import styles from '../SettingsPage.module.scss';

export const MaintenanceSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const exports = useDiagnosticsExportStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');

  const handleCaptureSnapshot = async () => {
    try {
      const path = await exports.saveTelemetrySnapshot();

      message.success(
        t('settingsPage.developerTools.snapshotSuccess', { path })
      );
    } catch (error) {
      message.error(String(error));
    }
  };

  return (
    <>
      <FpsDiagnosticsCard />

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

      {hasDevTools && (
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

            <Button
              block
              size="small"
              loading={exports.saving}
              onClick={() => void handleCaptureSnapshot()}
            >
              {t('settingsPage.developerTools.downloadSnapshot')}
            </Button>
          </div>
        </SettingsCard>
      )}
    </>
  );
});

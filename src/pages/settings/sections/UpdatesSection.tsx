import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Switch } from 'antd';
import { AlertCircle, ArrowUpCircle, Clock, RefreshCw } from 'lucide-react';
import { ReleaseNotesButton } from '@pages/settings/ReleaseNotesButton/ReleaseNotesButton';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useAppUpdateStore } from '@features/app-update/app-update-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

const UPDATE_IN_PROGRESS = ['available', 'downloading', 'ready'];

export const UpdatesSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const appUpdate = useAppUpdateStore();
  const { t, i18n } = useTranslation('main-app');

  const intervalOptions = [
    { label: t('settingsPage.applicationUpdates.everyHour'), value: 1 },
    { label: t('settingsPage.applicationUpdates.every3Hours'), value: 3 },
    { label: t('settingsPage.applicationUpdates.every6Hours'), value: 6 },
    { label: t('settingsPage.applicationUpdates.every12Hours'), value: 12 },
    { label: t('settingsPage.applicationUpdates.daily'), value: 24 },
  ];

  return (
    <SettingsCard title={t('settingsPage.applicationUpdates.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.applicationUpdates.autoCheckTitle')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.applicationUpdates.autoCheckDesc')}
            </div>
          </div>

          <Switch
            checked={appSettings.appSettings.autoUpdate}
            onChange={(v) => appSettings.update({ autoUpdate: v })}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.applicationUpdates.checkIntervalTitle')}
            </div>

            <div className={styles.fieldDesc}>
              {t('settingsPage.applicationUpdates.checkIntervalDesc')}
            </div>
          </div>

          <Select
            className={styles.selectWidth}
            value={appSettings.appSettings.updateCheckInterval}
            onChange={(v: number) =>
              appSettings.update({ updateCheckInterval: v })
            }
            options={intervalOptions}
            disabled={!appSettings.appSettings.autoUpdate}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.applicationUpdates.currentVersion')}{' '}
              <span className={styles.versionLabel}>
                v{appUpdate.currentVersion}
              </span>
            </div>

            {appSettings.appSettings.lastUpdateCheck && (
              <div
                className={`${styles.fieldDesc} ${styles.fieldDescMeta}`}
                suppressHydrationWarning
              >
                <Clock size={12} />
                {t('settingsPage.applicationUpdates.lastChecked')}{' '}
                {new Date(
                  appSettings.appSettings.lastUpdateCheck
                ).toLocaleString(i18n.language)}
              </div>
            )}

            <div className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}>
              {appUpdate.status === 'idle' &&
                t('settingsPage.applicationUpdates.upToDate')}

              {appUpdate.status === 'checking' &&
                t('settingsPage.applicationUpdates.checkingForUpdates')}

              {appUpdate.status === 'available' && (
                <span className={styles.statusSuccess}>
                  {t('settingsPage.applicationUpdates.newVersionAvailable', {
                    version: appUpdate.availableVersion,
                  })}
                </span>
              )}

              {appUpdate.status === 'downloading' &&
                t('settingsPage.applicationUpdates.downloadingUpdate')}

              {appUpdate.status === 'ready' &&
                t('settingsPage.applicationUpdates.updateDownloaded')}

              {appUpdate.status === 'error' && (
                <span className={styles.statusError}>
                  <AlertCircle size={12} className={styles.errorIcon} />
                  {t('settingsPage.applicationUpdates.updateCheckFailed')}
                </span>
              )}
            </div>
          </div>

          {UPDATE_IN_PROGRESS.includes(appUpdate.status) ? (
            <div className={styles.updateActions}>
              <ReleaseNotesButton />

              <Button
                type="primary"
                icon={<ArrowUpCircle size={16} />}
                onClick={() => void appUpdate.installUpdate()}
                loading={appUpdate.status === 'downloading'}
                disabled={appUpdate.status === 'ready'}
              >
                {appUpdate.status === 'ready'
                  ? t('settingsPage.applicationUpdates.restarting')
                  : t('settingsPage.applicationUpdates.installAndRestart')}
              </Button>
            </div>
          ) : (
            <Button
              icon={
                <RefreshCw
                  size={16}
                  className={
                    appUpdate.status === 'checking' ? 'anticon-spin' : ''
                  }
                />
              }
              onClick={() => void appUpdate.checkForUpdates()}
              disabled={appUpdate.status === 'checking'}
            >
              {appUpdate.status === 'checking'
                ? t('settingsPage.applicationUpdates.checkingEllipsis')
                : t('settingsPage.applicationUpdates.checkForUpdates')}
            </Button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
});

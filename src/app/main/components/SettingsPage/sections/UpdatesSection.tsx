import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Switch } from 'antd';
import { AlertCircle, ArrowUpCircle, Clock, RefreshCw } from 'lucide-react';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import { useAppSettingsStore } from '@store/root-store-context';
import { SettingsCard } from '../SettingsCard';
import styles from '../SettingsPage.module.scss';

const UPDATE_IN_PROGRESS = ['available', 'downloading', 'ready'];

export const UpdatesSection = observer(() => {
  const appSettings = useAppSettingsStore();
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
            onChange={(v) => appSettings.setAutoUpdate(v)}
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
            onChange={(v: number) => appSettings.setUpdateCheckInterval(v)}
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
                v{appSettings.currentVersion}
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
              {appSettings.updateStatus === 'idle' &&
                t('settingsPage.applicationUpdates.upToDate')}

              {appSettings.updateStatus === 'checking' &&
                t('settingsPage.applicationUpdates.checkingForUpdates')}

              {appSettings.updateStatus === 'available' && (
                <span className={styles.statusSuccess}>
                  {t('settingsPage.applicationUpdates.newVersionAvailable', {
                    version: appSettings.availableVersion,
                  })}
                </span>
              )}

              {appSettings.updateStatus === 'downloading' &&
                t('settingsPage.applicationUpdates.downloadingUpdate')}

              {appSettings.updateStatus === 'ready' &&
                t('settingsPage.applicationUpdates.updateDownloaded')}

              {appSettings.updateStatus === 'error' && (
                <span className={styles.statusError}>
                  <AlertCircle size={12} className={styles.errorIcon} />
                  {t('settingsPage.applicationUpdates.updateCheckFailed')}
                </span>
              )}
            </div>
          </div>

          {UPDATE_IN_PROGRESS.includes(appSettings.updateStatus) ? (
            <div className={styles.updateActions}>
              <ReleaseNotesButton />

              <Button
                type="primary"
                icon={<ArrowUpCircle size={16} />}
                onClick={() => void appSettings.installUpdate()}
                loading={appSettings.updateStatus === 'downloading'}
                disabled={appSettings.updateStatus === 'ready'}
              >
                {appSettings.updateStatus === 'ready'
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
                    appSettings.updateStatus === 'checking'
                      ? 'anticon-spin'
                      : ''
                  }
                />
              }
              onClick={() => void appSettings.checkForUpdates()}
              disabled={appSettings.updateStatus === 'checking'}
            >
              {appSettings.updateStatus === 'checking'
                ? t('settingsPage.applicationUpdates.checkingEllipsis')
                : t('settingsPage.applicationUpdates.checkForUpdates')}
            </Button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
});

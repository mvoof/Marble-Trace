import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Switch, Segmented, Select, Popconfirm, Flex } from 'antd';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { UnitSystem } from '@/types';
import type { AppLanguage } from '@store/settings/app-settings.store';
import { downloadSnapshot } from '@/utils/capture-snapshot';
import { useStore } from '@store/root-store-context';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import {
  RefreshCw,
  ArrowUpCircle,
  AlertCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import { TRACK_MAP_CLEAR } from '@store/sync/sim-events';
import styles from './SettingsPage.module.scss';
import {
  useAppSettingsStore,
  useSessionStore,
  useTrackMapWidgetStore,
  useUnitsStore,
} from '@store/root-store-context';

const isDev = import.meta.env.DEV;

interface CardProps {
  title?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => (
  <div className={styles.card}>
    {title && <h3 className={styles.cardTitle}>{title}</h3>}

    <div className={styles.cardContent}>{children}</div>
  </div>
);

export const SettingsPage = observer(() => {
  const appSettings = useAppSettingsStore();
  const units = useUnitsStore();
  const store = useStore();
  const trackMap = useTrackMapWidgetStore();
  const session = useSessionStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');
  const [resettingPitLane, setResettingPitLane] = useState(false);

  const languageOptions: { value: AppLanguage; label: string }[] = [
    { value: 'system', label: t('settingsPage.language.system') },
    { value: 'en', label: 'English' },
    { value: 'ru', label: 'Русский' },
    { value: 'zh', label: '中文' },
  ];

  const trackId = trackMap.trackShape?.trackId ?? null;
  const trackDisplayName = session.sessionInfo?.trackDisplayName ?? null;
  const sessionTrackId =
    session.sessionInfo && session.sessionInfo.trackId >= 0
      ? session.sessionInfo.trackId
      : null;

  const playerCar = session.sessionInfo?.cars.find(
    (car) => car.carIdx === session.sessionInfo?.playerCarIdx
  );
  const canDeleteReferenceLap = sessionTrackId !== null && playerCar != null;

  const handleResetPitLane = async () => {
    if (trackId === null) return;
    setResettingPitLane(true);
    try {
      await invoke('reset_pit_lane_pct', { trackId });
      message.success(t('settingsPage.trackMap.pitLaneResetSuccess'));
    } finally {
      setResettingPitLane(false);
    }
  };

  const handleDeleteReferenceLap = async () => {
    if (sessionTrackId === null || !playerCar) return;

    await invoke('delete_reference_lap', {
      trackId: sessionTrackId,
      carScreenName: playerCar.carScreenName,
    });
    store.referenceLap.reset();
    message.success(t('settingsPage.trackMap.referenceLapDeleteSuccess'));
  };

  const handleCaptureSnapshot = () => {
    downloadSnapshot(store, 'iracing');

    message.success(t('settingsPage.developerTools.snapshotSuccess'));
  };

  return (
    <div className={styles.animateFadeIn}>
      <header className={styles.header}>
        <span className={styles.moduleLabel}>
          {t('settingsPage.moduleLabel')}
        </span>

        <h1 className={styles.title}>{t('settingsPage.title')}</h1>
      </header>

      <div className={styles.cardGrid}>
        <Card title={t('settingsPage.language.title')}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPage.language.fieldLabel')}
            </span>

            <Select
              className={styles.selectWidth}
              value={appSettings.appSettings.language}
              onChange={(value: AppLanguage) => appSettings.setLanguage(value)}
              options={languageOptions}
            />
          </div>
        </Card>

        <Card title={t('settingsPage.widgetDisplayOverride.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>
                  {t('settingsPage.widgetDisplayOverride.hideAllTitle')}
                </div>

                <div className={styles.fieldDesc}>
                  {t('settingsPage.widgetDisplayOverride.hideAllDesc')}
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.hideAllWidgets}
                onChange={(v) => appSettings.setHideAllWidgets(v)}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPage.widgetDisplayOverride.toggleHotkey')}
            </span>

            <HotkeyRecorder
              currentHotkey={appSettings.appSettings.hideAllWidgetsHotkey}
              onApply={(key) => appSettings.setHideAllWidgetsHotkey(key)}
            />
          </div>
        </Card>

        <Card title={t('settingsPage.startupBehavior.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>
                  {t('settingsPage.startupBehavior.launchMinimizedTitle')}
                </div>

                <div className={styles.fieldDesc}>
                  {t('settingsPage.startupBehavior.launchMinimizedDesc')}
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.startMinimized}
                onChange={(v) => appSettings.setStartMinimized(v)}
              />
            </div>
          </div>
        </Card>

        <Card title={t('settingsPage.interactionMode.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>
                  {t('settingsPage.interactionMode.dragModeTitle')}
                </div>

                <div className={styles.fieldDesc}>
                  {t('settingsPage.interactionMode.dragModeDesc')}
                </div>
              </div>

              <Switch
                checked={appSettings.dragMode}
                onChange={() => appSettings.toggleDragMode()}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPage.interactionMode.dragModeHotkey')}
            </span>

            <HotkeyRecorder
              currentHotkey={appSettings.appSettings.dragHotkey}
              onApply={(key) => appSettings.setDragHotkey(key)}
            />
          </div>
        </Card>

        <Card title={t('settingsPage.gameIntegration.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>
                  {t('settingsPage.gameIntegration.autoHideTitle')}
                </div>

                <div className={styles.fieldDesc}>
                  {t('settingsPage.gameIntegration.autoHideDesc')}
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.hideWidgetsWhenGameClosed}
                onChange={(v) => appSettings.setHideWidgetsWhenGameClosed(v)}
              />
            </div>
          </div>
        </Card>

        <Card title={t('settingsPage.systemUnits.title')}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPage.systemUnits.fieldLabel')}
            </span>

            <Segmented
              block
              options={[
                {
                  label: t('settingsPage.systemUnits.metric'),
                  value: 'metric',
                },
                {
                  label: t('settingsPage.systemUnits.imperial'),
                  value: 'imperial',
                },
              ]}
              value={units.unitSystem}
              onChange={(value) => {
                units.setSystem(value as UnitSystem);
              }}
            />
          </div>
        </Card>

        <Card title={t('settingsPage.applicationUpdates.title')}>
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
                options={[
                  {
                    label: t('settingsPage.applicationUpdates.everyHour'),
                    value: 1,
                  },
                  {
                    label: t('settingsPage.applicationUpdates.every3Hours'),
                    value: 3,
                  },
                  {
                    label: t('settingsPage.applicationUpdates.every6Hours'),
                    value: 6,
                  },
                  {
                    label: t('settingsPage.applicationUpdates.every12Hours'),
                    value: 12,
                  },
                  {
                    label: t('settingsPage.applicationUpdates.daily'),
                    value: 24,
                  },
                ]}
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
                    ).toLocaleString()}
                  </div>
                )}

                <div
                  className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}
                >
                  {appSettings.updateStatus === 'idle' &&
                    t('settingsPage.applicationUpdates.upToDate')}

                  {appSettings.updateStatus === 'checking' &&
                    t('settingsPage.applicationUpdates.checkingForUpdates')}

                  {appSettings.updateStatus === 'available' && (
                    <span className={styles.statusSuccess}>
                      {t(
                        'settingsPage.applicationUpdates.newVersionAvailable',
                        {
                          version: appSettings.availableVersion,
                        }
                      )}
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

              {['available', 'downloading', 'ready'].includes(
                appSettings.updateStatus
              ) ? (
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
        </Card>

        <Card title={t('settingsPage.trackMap.title')}>
          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.trackMap.reRecordTitle')}
            </div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {t('settingsPage.trackMap.reRecordDesc')}
            </div>

            <Flex gap={8}>
              <Button
                style={{ flex: 1 }}
                size="small"
                danger
                disabled={sessionTrackId === null}
                onClick={() => void emit(TRACK_MAP_CLEAR)}
              >
                {t('settingsPage.trackMap.resetCurrentTrackData')}
              </Button>

              <Button
                style={{ flex: 1 }}
                size="small"
                disabled={sessionTrackId === null}
                onClick={() => {
                  void emit('track-map:force-start');
                  message.info(t('settingsPage.trackMap.manualStartActive'));
                }}
              >
                {t('settingsPage.trackMap.forceStartRecording')}
              </Button>
            </Flex>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.trackMap.pitLaneCalibrationTitle')}
            </div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {trackId !== null && trackDisplayName !== null
                ? t('settingsPage.trackMap.pitLaneCalibrationDescWithTrack', {
                    track: trackDisplayName,
                  })
                : t('settingsPage.trackMap.pitLaneCalibrationDescNoTrack')}
            </div>

            <Button
              block
              size="small"
              danger
              disabled={trackId === null}
              loading={resettingPitLane}
              onClick={() => void handleResetPitLane()}
            >
              {trackDisplayName !== null
                ? t('settingsPage.trackMap.resetPitLaneDataForTrack', {
                    track: trackDisplayName,
                  })
                : t('settingsPage.trackMap.resetPitLaneData')}
            </Button>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>
              {t('settingsPage.trackMap.referenceLapTitle')}
            </div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {canDeleteReferenceLap
                ? t('settingsPage.trackMap.referenceLapDescWithCar', {
                    car: playerCar?.carScreenName,
                  })
                : t('settingsPage.trackMap.referenceLapDescNoSession')}
            </div>

            <Popconfirm
              title={t('settingsPage.trackMap.deleteReferenceLapConfirm')}
              okText={t('layoutEditor.delete')}
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDeleteReferenceLap()}
            >
              <Button
                block
                size="small"
                danger
                disabled={!canDeleteReferenceLap}
              >
                {t('settingsPage.trackMap.deleteReferenceLap')}
              </Button>
            </Popconfirm>
          </div>
        </Card>

        <Card title={t('settingsPage.reset.title')}>
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
        </Card>

        {isDev && (
          <Card title={t('settingsPage.developerTools.title')}>
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
          </Card>
        )}
      </div>
    </div>
  );
});

import React from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Switch, Segmented, message, Select } from 'antd';
import { appSettingsStore } from '@store/app-settings.store';
import { unitsStore } from '@store/units.store';
import type { UnitSystem } from '@/types';
import { downloadSnapshot } from '@/storybook/capture-snapshot';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import { RefreshCw, ArrowUpCircle, AlertCircle, Clock } from 'lucide-react';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import styles from './SettingsPage.module.scss';

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
  const [messageApi, contextHolder] = message.useMessage();

  const handleCaptureSnapshot = () => {
    downloadSnapshot('iracing');

    messageApi.success('Snapshot saved — place the JSON in test-data/');
  };

  return (
    <div className={styles.animateFadeIn}>
      {contextHolder}

      <header className={styles.header}>
        <span className={styles.moduleLabel}>Configuration</span>

        <h1 className={styles.title}>Global Application Settings</h1>
      </header>

      <Card title="Widget Display Override">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Hide all active widgets</div>

              <div className={styles.fieldDesc}>
                Global toggle to quickly hide or show all enabled UI elements.
              </div>
            </div>

            <Switch
              checked={appSettingsStore.settings.hideAllWidgets}
              onChange={(v) => appSettingsStore.setHideAllWidgets(v)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Toggle Hotkey</span>

          <HotkeyRecorder
            currentHotkey={appSettingsStore.settings.hideAllWidgetsHotkey}
            onApply={(key) => appSettingsStore.setHideAllWidgetsHotkey(key)}
          />
        </div>
      </Card>

      <Card title="Interaction Mode">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>UI Drag Mode</div>

              <div className={styles.fieldDesc}>
                Unlock widgets to move them freely across the screen.
              </div>
            </div>

            <Switch
              checked={appSettingsStore.dragMode}
              onChange={() => appSettingsStore.toggleDragMode()}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Drag Mode Hotkey</span>

          <HotkeyRecorder
            currentHotkey={appSettingsStore.settings.dragHotkey}
            onApply={(key) => appSettingsStore.setDragHotkey(key)}
          />
        </div>
      </Card>

      <Card title="Game Integration">
        <div className={styles.fieldRow}>
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>Auto-Hide System</div>

            <div className={styles.fieldDesc}>
              Hide widgets when iRacing is not running.
            </div>
          </div>

          <Switch
            checked={appSettingsStore.settings.hideWidgetsWhenGameClosed}
            onChange={(v) => appSettingsStore.setHideWidgetsWhenGameClosed(v)}
          />
        </div>
      </Card>

      <Card title="System Units">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Measurement System</span>

          <Segmented
            block
            options={[
              { label: 'Metric (km/h, °C, L)', value: 'metric' },
              { label: 'Imperial (mph, °F, gal)', value: 'imperial' },
            ]}
            value={unitsStore.system}
            onChange={(value) => {
              void unitsStore.setSystem(value as UnitSystem);
            }}
          />
        </div>
      </Card>

      <Card title="Application Updates">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Auto-Check for Updates</div>

              <div className={styles.fieldDesc}>
                Automatically check for new versions on application startup.
              </div>
            </div>

            <Switch
              checked={appSettingsStore.settings.autoUpdate}
              onChange={(v) => appSettingsStore.setAutoUpdate(v)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Check Interval</div>

              <div className={styles.fieldDesc}>
                How often to check for updates while the app is running.
              </div>
            </div>

            <Select
              className={styles.selectWidth}
              value={appSettingsStore.settings.updateCheckInterval}
              onChange={(v) => appSettingsStore.setUpdateCheckInterval(v)}
              options={[
                { label: 'Every hour', value: 1 },
                { label: 'Every 3 hours', value: 3 },
                { label: 'Every 6 hours', value: 6 },
                { label: 'Every 12 hours', value: 12 },
                { label: 'Daily', value: 24 },
              ]}
              disabled={!appSettingsStore.settings.autoUpdate}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                Current Version:{' '}
                <span className={styles.versionLabel}>
                  v{appSettingsStore.currentVersion}
                </span>
              </div>

              {appSettingsStore.settings.lastUpdateCheck && (
                <div
                  className={`${styles.fieldDesc} ${styles.fieldDescMeta}`}
                  suppressHydrationWarning
                >
                  <Clock size={12} />
                  Last checked:{' '}
                  {new Date(
                    appSettingsStore.settings.lastUpdateCheck
                  ).toLocaleString()}
                </div>
              )}

              <div className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}>
                {appSettingsStore.updateStatus === 'idle' &&
                  'Your application is up to date.'}

                {appSettingsStore.updateStatus === 'checking' &&
                  'Checking for updates...'}

                {appSettingsStore.updateStatus === 'available' && (
                  <span className={styles.statusSuccess}>
                    New version v{appSettingsStore.availableVersion} is
                    available!
                  </span>
                )}
                {appSettingsStore.updateStatus === 'downloading' &&
                  'Downloading update...'}

                {appSettingsStore.updateStatus === 'ready' &&
                  'Update downloaded. Restarting...'}

                {appSettingsStore.updateStatus === 'error' && (
                  <span className={styles.statusError}>
                    <AlertCircle size={12} className={styles.errorIcon} />
                    Update check failed.
                  </span>
                )}
              </div>
            </div>

            {['available', 'downloading', 'ready'].includes(
              appSettingsStore.updateStatus
            ) ? (
              <div className={styles.updateActions}>
                <ReleaseNotesButton />

                <Button
                  type="primary"
                  icon={<ArrowUpCircle size={16} />}
                  onClick={() => void appSettingsStore.installUpdate()}
                  loading={appSettingsStore.updateStatus === 'downloading'}
                  disabled={appSettingsStore.updateStatus === 'ready'}
                >
                  {appSettingsStore.updateStatus === 'ready'
                    ? 'Restarting...'
                    : 'Install & Restart'}
                </Button>
              </div>
            ) : (
              <Button
                icon={
                  <RefreshCw
                    size={16}
                    className={
                      appSettingsStore.updateStatus === 'checking'
                        ? 'anticon-spin'
                        : ''
                    }
                  />
                }
                onClick={() => void appSettingsStore.checkForUpdates()}
                disabled={appSettingsStore.updateStatus === 'checking'}
              >
                {appSettingsStore.updateStatus === 'checking'
                  ? 'Checking...'
                  : 'Check for Updates'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isDev && (
        <Card title="Developer Tools">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>Telemetry Snapshot</div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              Capture current telemetry state.
            </div>

            <Button block size="small" onClick={handleCaptureSnapshot}>
              Download Snapshot JSON
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
});

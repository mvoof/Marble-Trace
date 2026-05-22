import React from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Switch, Segmented, message, Select } from 'antd';
import type { UnitSystem } from '@/types';
import { downloadSnapshot } from '@/storybook/capture-snapshot';
import { useTelemetryStore } from '@store/root-store-context';
import { HotkeyRecorder } from '@app/main/components/HotkeyRecorder/HotkeyRecorder';
import { RefreshCw, ArrowUpCircle, AlertCircle, Clock } from 'lucide-react';
import { ReleaseNotesButton } from '@app/main/components/ReleaseNotesButton/ReleaseNotesButton';
import styles from './SettingsPage.module.scss';
import { useAppSettingsStore, useUnitsStore } from '@store/root-store-context';

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
  const telemetry = useTelemetryStore();

  const [messageApi, contextHolder] = message.useMessage();

  const handleCaptureSnapshot = () => {
    downloadSnapshot(telemetry, 'iracing');

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
              checked={appSettings.settings.hideAllWidgets}
              onChange={(v) => appSettings.setHideAllWidgets(v)}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Toggle Hotkey</span>

          <HotkeyRecorder
            currentHotkey={appSettings.settings.hideAllWidgetsHotkey}
            onApply={(key) => appSettings.setHideAllWidgetsHotkey(key)}
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
              checked={appSettings.dragMode}
              onChange={() => appSettings.toggleDragMode()}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Drag Mode Hotkey</span>

          <HotkeyRecorder
            currentHotkey={appSettings.settings.dragHotkey}
            onApply={(key) => appSettings.setDragHotkey(key)}
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
            checked={appSettings.settings.hideWidgetsWhenGameClosed}
            onChange={(v) => appSettings.setHideWidgetsWhenGameClosed(v)}
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
            value={units.system}
            onChange={(value) => {
              void units.setSystem(value as UnitSystem);
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
              checked={appSettings.settings.autoUpdate}
              onChange={(v) => appSettings.setAutoUpdate(v)}
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
              value={appSettings.settings.updateCheckInterval}
              onChange={(v) => appSettings.setUpdateCheckInterval(v)}
              options={[
                { label: 'Every hour', value: 1 },
                { label: 'Every 3 hours', value: 3 },
                { label: 'Every 6 hours', value: 6 },
                { label: 'Every 12 hours', value: 12 },
                { label: 'Daily', value: 24 },
              ]}
              disabled={!appSettings.settings.autoUpdate}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>
                Current Version:{' '}
                <span className={styles.versionLabel}>
                  v{appSettings.currentVersion}
                </span>
              </div>

              {appSettings.settings.lastUpdateCheck && (
                <div
                  className={`${styles.fieldDesc} ${styles.fieldDescMeta}`}
                  suppressHydrationWarning
                >
                  <Clock size={12} />
                  Last checked:{' '}
                  {new Date(
                    appSettings.settings.lastUpdateCheck
                  ).toLocaleString()}
                </div>
              )}

              <div className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}>
                {appSettings.updateStatus === 'idle' &&
                  'Your application is up to date.'}

                {appSettings.updateStatus === 'checking' &&
                  'Checking for updates...'}

                {appSettings.updateStatus === 'available' && (
                  <span className={styles.statusSuccess}>
                    New version v{appSettings.availableVersion} is available!
                  </span>
                )}
                {appSettings.updateStatus === 'downloading' &&
                  'Downloading update...'}

                {appSettings.updateStatus === 'ready' &&
                  'Update downloaded. Restarting...'}

                {appSettings.updateStatus === 'error' && (
                  <span className={styles.statusError}>
                    <AlertCircle size={12} className={styles.errorIcon} />
                    Update check failed.
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

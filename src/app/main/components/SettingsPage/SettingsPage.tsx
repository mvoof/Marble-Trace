import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Switch, Segmented, message, Select, Popconfirm } from 'antd';
import type { UnitSystem } from '@/types';
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
import { availableMonitors } from '@tauri-apps/api/window';
import type { Monitor } from '@tauri-apps/api/window';
import styles from './SettingsPage.module.scss';
import { useAppSettingsStore, useUnitsStore } from '@store/root-store-context';

const isDev = import.meta.env.DEV;
const WIN32_DISPLAY_PREFIX = /^\\\\\.\\/;

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
  const [monitors, setMonitors] = useState<Monitor[]>([]);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    availableMonitors().then(setMonitors).catch(console.error);
  }, []);

  const handleCaptureSnapshot = () => {
    downloadSnapshot(store, 'iracing');

    messageApi.success('Snapshot saved — place the JSON in test-data/');
  };

  return (
    <div className={styles.animateFadeIn}>
      {contextHolder}

      <header className={styles.header}>
        <span className={styles.moduleLabel}>Configuration</span>

        <h1 className={styles.title}>Global Application Settings</h1>
      </header>

      <div className={styles.cardGrid}>
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
                checked={appSettings.appSettings.hideAllWidgets}
                onChange={(v) => appSettings.setHideAllWidgets(v)}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Toggle Hotkey</span>

            <HotkeyRecorder
              currentHotkey={appSettings.appSettings.hideAllWidgetsHotkey}
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
              currentHotkey={appSettings.appSettings.dragHotkey}
              onApply={(key) => appSettings.setDragHotkey(key)}
            />
          </div>
        </Card>

        <Card title="Display">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>Overlay Monitor</div>

                <div className={styles.fieldDesc}>
                  Select which monitor the overlay is rendered on.
                </div>
              </div>

              <Select
                className={styles.selectWidth}
                value={appSettings.appSettings.overlayMonitorIndex ?? -1}
                onChange={(value: number) =>
                  appSettings.setOverlayMonitorIndex(
                    value === -1 ? null : value
                  )
                }
                options={[
                  { label: 'Primary monitor', value: -1 },
                  ...monitors.map((monitor, index) => ({
                    label: monitor.name
                      ? `${monitor.name.replace(WIN32_DISPLAY_PREFIX, '')} (${monitor.size.width}×${monitor.size.height})`
                      : `Monitor ${index + 1} (${monitor.size.width}×${monitor.size.height})`,
                    value: index,
                  })),
                ]}
              />
            </div>
          </div>
        </Card>

        <Card title="Game Integration">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>Auto-Hide System</div>

                <div className={styles.fieldDesc}>
                  Hide widgets when the simulator is not running.
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.hideWidgetsWhenGameClosed}
                onChange={(v) => appSettings.setHideWidgetsWhenGameClosed(v)}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>Hide in Garage</div>

                <div className={styles.fieldDesc}>
                  Hide widgets when the car is in the garage.
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.hideWidgetsInGarage}
                onChange={(v) => appSettings.setHideWidgetsInGarage(v)}
              />
            </div>
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
              value={units.unitSystem}
              onChange={(value) => {
                units.setSystem(value as UnitSystem);
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
                checked={appSettings.appSettings.autoUpdate}
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
                value={appSettings.appSettings.updateCheckInterval}
                onChange={(v) => appSettings.setUpdateCheckInterval(v)}
                options={[
                  { label: 'Every hour', value: 1 },
                  { label: 'Every 3 hours', value: 3 },
                  { label: 'Every 6 hours', value: 6 },
                  { label: 'Every 12 hours', value: 12 },
                  { label: 'Daily', value: 24 },
                ]}
                disabled={!appSettings.appSettings.autoUpdate}
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

                {appSettings.appSettings.lastUpdateCheck && (
                  <div
                    className={`${styles.fieldDesc} ${styles.fieldDescMeta}`}
                    suppressHydrationWarning
                  >
                    <Clock size={12} />
                    Last checked:{' '}
                    {new Date(
                      appSettings.appSettings.lastUpdateCheck
                    ).toLocaleString()}
                  </div>
                )}

                <div
                  className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}
                >
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

        <Card title="Reset">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>Reset All Settings</div>

                <div className={styles.fieldDesc}>
                  Clears all widget positions, sizes, and preferences. The app
                  will restart automatically.
                </div>
              </div>

              <Popconfirm
                title="Reset all settings?"
                description="Widget layout and all preferences will be lost."
                okText="Reset & Restart"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                onConfirm={() => void appSettings.resetSettings()}
              >
                <Button danger icon={<RotateCcw size={16} />}>
                  Reset Settings
                </Button>
              </Popconfirm>
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
    </div>
  );
});

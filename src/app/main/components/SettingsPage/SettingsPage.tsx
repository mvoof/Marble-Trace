import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { App, Button, Switch, Segmented, Select, Popconfirm, Flex } from 'antd';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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
  const [resettingPitLane, setResettingPitLane] = useState(false);

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
      message.success(
        'Pit lane data cleared. Drive through pit lane to re-calibrate.'
      );
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
    message.success(
      'Reference lap deleted. Recording restarts on the next completed lap.'
    );
  };

  const handleCaptureSnapshot = () => {
    downloadSnapshot(store, 'iracing');

    message.success('Snapshot saved — place the JSON in test-data/');
  };

  return (
    <div className={styles.animateFadeIn}>
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

        <Card title="Startup Behavior">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>Launch Minimized</div>

                <div className={styles.fieldDesc}>
                  Start the application minimized to the taskbar.
                </div>
              </div>

              <Switch
                checked={appSettings.appSettings.startMinimized}
                onChange={(v) => appSettings.setStartMinimized(v)}
              />
            </div>
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
                onChange={(v: number) => appSettings.setUpdateCheckInterval(v)}
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

        <Card title="Track Map">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>Re-record Track</div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              Clears current map data and starts fresh on next lap crossing or
              manual trigger.
            </div>

            <Flex gap={8}>
              <Button
                style={{ flex: 1 }}
                size="small"
                danger
                disabled={sessionTrackId === null}
                onClick={() => void emit(TRACK_MAP_CLEAR)}
              >
                Reset Current Track Data
              </Button>

              <Button
                style={{ flex: 1 }}
                size="small"
                disabled={sessionTrackId === null}
                onClick={() => {
                  void emit('track-map:force-start');
                  message.info(
                    'Manual start active. Drive to begin recording.'
                  );
                }}
              >
                Force Start Recording
              </Button>
            </Flex>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>Pit Lane Calibration</div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {trackId !== null && trackDisplayName !== null
                ? `Clears pit entry/exit points recorded for "${trackDisplayName}". Drive through the pit lane again to re-calibrate.`
                : 'No track loaded. Load a session to reset pit lane data for the active track.'}
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
                ? `Reset Pit Lane Data for ${trackDisplayName}`
                : 'Reset Pit Lane Data'}
            </Button>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>Reference Lap</div>

            <div
              className={`${styles.fieldDesc} ${styles.fieldDescBeforeAction}`}
            >
              {canDeleteReferenceLap
                ? `Deletes the stored best lap for "${playerCar?.carScreenName}" on the current track. Recording restarts on the next completed lap.`
                : 'No session loaded. Load a session to delete the reference lap for the active track and car.'}
            </div>

            <Popconfirm
              title="Delete the stored reference lap?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDeleteReferenceLap()}
            >
              <Button
                block
                size="small"
                danger
                disabled={!canDeleteReferenceLap}
              >
                Delete Reference Lap
              </Button>
            </Popconfirm>
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

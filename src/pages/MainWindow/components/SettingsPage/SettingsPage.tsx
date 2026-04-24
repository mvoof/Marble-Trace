import React from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Switch, Segmented, message } from 'antd';
import { appSettingsStore } from '../../../../store/app-settings.store';
import { unitsStore } from '../../../../store/units.store';
import type { UnitSystem } from '../../../../types/units';
import { downloadSnapshot } from '../../../../storybook/capture-snapshot';
import { HotkeyRecorder } from '../../../../components/shared/HotkeyRecorder';
import styles from '../WidgetSettings/WidgetSettings.module.scss';

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
              checked={appSettingsStore.hideAllWidgets}
              onChange={(v) => {
                void appSettingsStore.setHideAllWidgets(v);
              }}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Toggle Hotkey</span>
          <HotkeyRecorder
            currentHotkey={appSettingsStore.hideAllWidgetsHotkey}
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
            currentHotkey={appSettingsStore.dragHotkey}
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
            checked={appSettingsStore.hideWidgetsWhenGameClosed}
            onChange={(v) => {
              void appSettingsStore.setHideWidgetsWhenGameClosed(v);
            }}
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

      {isDev && (
        <Card title="Developer Tools">
          <div className={styles.fieldGroup}>
            <div className={styles.fieldTitle}>Telemetry Snapshot</div>
            <div className={styles.fieldDesc} style={{ marginBottom: 16 }}>
              Capture current telemetry state for Storybook fixtures.
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

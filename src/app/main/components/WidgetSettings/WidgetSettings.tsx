import { observer } from 'mobx-react-lite';
import { InputNumber, Row, Col, ColorPicker } from 'antd';
import styles from './WidgetSettings.module.scss';
import { Card } from './panels/Card';
import { SpeedSettingsPanel } from './panels/SpeedSettingsPanel';
import { InputTraceSettingsPanel } from './panels/InputTraceSettingsPanel';
import { RadarSettingsPanel } from './panels/RadarSettingsPanel';
import { StandingsSettingsPanel } from './panels/StandingsSettingsPanel';
import { RelativeSettingsPanel } from './panels/RelativeSettingsPanel';
import { LinearMapSettingsPanel } from './panels/LinearMapSettingsPanel';
import { TrackMapSettingsPanel } from './panels/TrackMapSettingsPanel';
import { WeatherSettingsPanel } from './panels/WeatherSettingsPanel';
import { FuelSettingsPanel } from './panels/FuelSettingsPanel';
import { DeltaSettingsPanel } from './panels/DeltaSettingsPanel';
import { SectorMatrixSettingsPanel } from './panels/SectorMatrixSettingsPanel';
import { LapLogSettingsPanel } from './panels/LapLogSettingsPanel';
import { ChassisSettingsPanel } from './panels/ChassisSettingsPanel';
import { TimerSettingsPanel } from './panels/TimerSettingsPanel';
import { FlagDisplaySettingsPanel } from './panels/FlagDisplaySettingsPanel';
import { GMeterSettingsPanel } from './panels/GMeterSettingsPanel';
import { EnginePanelSettingsPanel } from './panels/EnginePanelSettingsPanel';
import { useWidgetEditor } from './WidgetEditorContext';

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const widgetSettings = useWidgetEditor();

    if (!widgetId) {
      return (
        <div className={styles.fieldDesc}>Select a widget to configure</div>
      );
    }

    const widget = widgetSettings.getWidget(widgetId);

    if (!widget) {
      return <div className={styles.fieldDesc}>Widget not found</div>;
    }

    const userSettings = widget.userSettings;

    return (
      <div className={`${styles.animateFadeIn} ${styles.settingsRoot}`}>
        <header className={styles.header}>
          <span className={styles.moduleLabel}>Module Config</span>
          <h1 className={styles.title}>{widget.label}</h1>
        </header>

        <Card title="Layout & Dimensions">
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <span className={styles.fieldLabel}>Position X</span>
              <InputNumber
                style={{ width: '100%' }}
                value={userSettings.x}
                onChange={(v) => {
                  if (v !== null) {
                    widgetSettings.pushUndo?.();
                    widgetSettings.updateUserSettings(widgetId, { x: v });
                  }
                }}
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Position Y</span>
              <InputNumber
                style={{ width: '100%' }}
                value={userSettings.y}
                onChange={(v) => {
                  if (v !== null) {
                    widgetSettings.pushUndo?.();
                    widgetSettings.updateUserSettings(widgetId, { y: v });
                  }
                }}
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Width (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={userSettings.currentWidth}
                min={10}
                onChange={(v) => {
                  if (v !== null) {
                    widgetSettings.pushUndo?.();
                    widgetSettings.updateUserSettings(widgetId, {
                      currentWidth: v,
                    });
                  }
                }}
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Height (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={userSettings.currentHeight}
                min={10}
                onChange={(v) => {
                  if (v !== null) {
                    widgetSettings.pushUndo?.();
                    widgetSettings.updateUserSettings(widgetId, {
                      currentHeight: v,
                    });
                  }
                }}
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Layer Depth (Z-Index)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={userSettings.zIndex ?? 0}
                onChange={(v) => {
                  if (v !== null) {
                    widgetSettings.pushUndo?.();
                    widgetSettings.updateUserSettings(widgetId, {
                      zIndex: v,
                    });
                  }
                }}
              />
            </Col>
          </Row>
        </Card>

        {!['radar-bar', 'led-flags', 'flat-flags'].includes(widgetId) && (
          <Card title="Aesthetics">
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <span className={styles.fieldLabel}>Background</span>
                <div className={styles.colorPickerContainer}>
                  <ColorPicker
                    value={
                      userSettings.backgroundColor ?? 'rgba(21, 22, 26, 0.8)'
                    }
                    allowClear
                    onChange={(color) =>
                      widgetSettings.updateUserSettings(widgetId, {
                        backgroundColor: color
                          ? color.toRgbString()
                          : 'transparent',
                      })
                    }
                  />
                  <div className={styles.fieldDesc}>
                    {userSettings.backgroundColor ?? 'transparent'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <span className={styles.fieldLabel}>Border</span>
                <div className={styles.colorPickerContainer}>
                  <ColorPicker
                    value={
                      userSettings.borderColor ?? 'rgba(255, 255, 255, 0.1)'
                    }
                    allowClear
                    onChange={(color) =>
                      widgetSettings.updateUserSettings(widgetId, {
                        borderColor: color.toRgbString(),
                      })
                    }
                  />
                  <div className={styles.fieldDesc}>
                    {userSettings.borderColor ?? 'transparent'}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {widgetId === 'speed' && <SpeedSettingsPanel />}
        {widgetId === 'input-trace' && <InputTraceSettingsPanel />}
        {(widgetId === 'proximity-radar' || widgetId === 'radar-bar') && (
          <RadarSettingsPanel widgetId={widgetId} />
        )}
        {widgetId === 'standings' && <StandingsSettingsPanel />}
        {widgetId === 'relative' && <RelativeSettingsPanel />}
        {widgetId === 'relative-map' && <LinearMapSettingsPanel />}
        {widgetId === 'track-map' && <TrackMapSettingsPanel />}
        {widgetId === 'weather' && <WeatherSettingsPanel />}
        {widgetId === 'fuel' && <FuelSettingsPanel />}
        {widgetId === 'delta' && <DeltaSettingsPanel />}
        {widgetId === 'sector-matrix' && <SectorMatrixSettingsPanel />}
        {widgetId === 'lap-log' && <LapLogSettingsPanel />}
        {widgetId === 'chassis' && <ChassisSettingsPanel />}
        {widgetId === 'timer' && <TimerSettingsPanel />}
        {(widgetId === 'led-flags' || widgetId === 'flat-flags') && (
          <FlagDisplaySettingsPanel widgetId={widgetId} />
        )}
        {widgetId === 'g-meter' && <GMeterSettingsPanel />}
        {widgetId === 'engine-panel' && <EnginePanelSettingsPanel />}
      </div>
    );
  }
);

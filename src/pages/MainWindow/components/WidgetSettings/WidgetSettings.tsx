import { observer } from 'mobx-react-lite';
import { InputNumber, Row, Col, ColorPicker } from 'antd';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import styles from './WidgetSettings.module.scss';
import { Card, HotkeyRecorderWrapper } from './panels/shared';
import { SpeedSettingsPanel } from './panels/SpeedSettingsPanel';
import { InputTraceSettingsPanel } from './panels/InputTraceSettingsPanel';
import { RadarSettingsPanel } from './panels/RadarSettingsPanel';
import { StandingsSettingsPanel } from './panels/StandingsSettingsPanel';
import { RelativeSettingsPanel } from './panels/RelativeSettingsPanel';
import { LinearMapSettingsPanel } from './panels/LinearMapSettingsPanel';
import { TrackMapSettingsPanel } from './panels/TrackMapSettingsPanel';
import { WeatherSettingsPanel } from './panels/WeatherSettingsPanel';
import { FuelSettingsPanel } from './panels/FuelSettingsPanel';
import { LapTimesSettingsPanel } from './panels/LapTimesSettingsPanel';
import { LapDeltaSettingsPanel } from './panels/LapDeltaSettingsPanel';
import { ChassisSettingsPanel } from './panels/ChassisSettingsPanel';
import { TimerSettingsPanel } from './panels/TimerSettingsPanel';
import { FlagDisplaySettingsPanel } from './panels/FlagDisplaySettingsPanel';

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    if (!widgetId) {
      return (
        <div className={styles.fieldDesc}>Select a widget to configure</div>
      );
    }

    const widget = widgetSettingsStore.getWidget(widgetId);

    if (!widget) {
      return <div className={styles.fieldDesc}>Widget not found</div>;
    }

    return (
      <div className={styles.animateFadeIn}>
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
                value={widget.x}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'x', v)
                }
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Position Y</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.y}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'y', v)
                }
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Width (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.width}
                min={10}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'width', v)
                }
              />
            </Col>

            <Col span={12}>
              <span className={styles.fieldLabel}>Height (px)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={widget.height}
                min={10}
                onChange={(v) =>
                  v !== null &&
                  widgetSettingsStore.updateField(widgetId, 'height', v)
                }
              />
            </Col>
          </Row>
        </Card>

        {!['radar-bar', 'flags', 'flat-flags'].includes(widgetId) && (
          <Card title="Aesthetics">
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <span className={styles.fieldLabel}>Background Center</span>
                <div className={styles.colorPickerContainer}>
                  <ColorPicker
                    value={widget.backgroundColor ?? '#252525'}
                    allowClear
                    onChange={(color) =>
                      widgetSettingsStore.updateField(
                        widgetId,
                        'backgroundColor',
                        color.toHexString()
                      )
                    }
                  />
                  <div className={styles.fieldDesc}>
                    {widget.backgroundColor ?? 'transparent'}
                  </div>
                </div>
              </Col>

              <Col span={12}>
                <span className={styles.fieldLabel}>Background Edge</span>
                <div className={styles.colorPickerContainer}>
                  <ColorPicker
                    value={widget.backgroundColorEdge ?? '#14141b'}
                    allowClear
                    onChange={(color) =>
                      widgetSettingsStore.updateField(
                        widgetId,
                        'backgroundColorEdge',
                        color.toHexString()
                      )
                    }
                  />
                  <div className={styles.fieldDesc}>
                    {widget.backgroundColorEdge ?? 'transparent'}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        <Card title="Controls">
          <HotkeyRecorderWrapper
            key={widgetId}
            widgetId={widgetId}
            currentHotkey={widget.hotkey}
          />
        </Card>

        {widgetId === 'speed' && <SpeedSettingsPanel />}
        {widgetId === 'input-trace' && <InputTraceSettingsPanel />}
        {(widgetId === 'proximity-radar' || widgetId === 'radar-bar') && (
          <RadarSettingsPanel widgetId={widgetId} />
        )}
        {widgetId === 'standings' && <StandingsSettingsPanel />}
        {widgetId === 'relative' && <RelativeSettingsPanel />}
        {widgetId === 'linear-map' && <LinearMapSettingsPanel />}
        {widgetId === 'track-map' && <TrackMapSettingsPanel />}
        {widgetId === 'weather' && <WeatherSettingsPanel />}
        {widgetId === 'fuel' && <FuelSettingsPanel />}
        {widgetId === 'lap-times' && <LapTimesSettingsPanel />}
        {widgetId === 'lap-delta' && <LapDeltaSettingsPanel />}
        {widgetId === 'chassis' && <ChassisSettingsPanel />}
        {widgetId === 'timer' && <TimerSettingsPanel />}
        {(widgetId === 'flags' || widgetId === 'flat-flags') && (
          <FlagDisplaySettingsPanel widgetId={widgetId} />
        )}
      </div>
    );
  }
);

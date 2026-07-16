import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Row, Col, ColorPicker, Slider } from 'antd';
import { getWidgetLabel } from '@utils/widget-i18n';
import styles from './WidgetSettings.module.scss';
import { Card } from './panels/Card';
import { RpmLightsSettingsPanel } from './panels/RpmLightsSettingsPanel';
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
import { RaceDashSettingsPanel } from './panels/RaceDashSettingsPanel';
import { useWidgetEditor } from './WidgetEditorContext';

export const WidgetSettings = observer(
  ({ widgetId }: { widgetId: string | null }) => {
    const widgetSettings = useWidgetEditor();
    const { t } = useTranslation('main-app');

    if (!widgetId) {
      return (
        <div className={styles.fieldDesc}>
          {t('widgetSettings.selectToConfigure')}
        </div>
      );
    }

    const widget = widgetSettings.getWidget(widgetId);

    if (!widget) {
      return (
        <div className={styles.fieldDesc}>{t('widgetSettings.notFound')}</div>
      );
    }

    const userSettings = widget.userSettings;

    return (
      <div className={`${styles.animateFadeIn} ${styles.settingsRoot}`}>
        <header className={styles.header}>
          <span className={styles.moduleLabel}>
            {t('widgetSettings.moduleConfig')}
          </span>
          <h1 className={styles.title}>{getWidgetLabel(t, widget)}</h1>
        </header>

        <Card title={t('widgetSettings.layoutAndDimensions')}>
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <span className={styles.fieldLabel}>
                {t('widgetSettings.positionX')}
              </span>
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
              <span className={styles.fieldLabel}>
                {t('widgetSettings.positionY')}
              </span>
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
              <span className={styles.fieldLabel}>
                {t('widgetSettings.width')}
              </span>
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
              <span className={styles.fieldLabel}>
                {t('widgetSettings.height')}
              </span>
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
              <span className={styles.fieldLabel}>
                {t('widgetSettings.layerDepth')}
              </span>
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

            <Col span={24}>
              <span className={styles.fieldLabel}>
                {t('widgetSettings.fontScale')}
              </span>
              <Slider
                min={0.7}
                max={1.8}
                step={0.05}
                value={userSettings.fontScale ?? 1}
                tooltip={{ formatter: (value) => `${value?.toFixed(2)}x` }}
                onChangeComplete={() => widgetSettings.pushUndo?.()}
                onChange={(v) => {
                  widgetSettings.updateUserSettings(widgetId, {
                    fontScale: v,
                  });
                }}
              />
              <div className={styles.fieldDesc}>
                {t('widgetSettings.fontScaleDesc')}
              </div>
            </Col>
          </Row>
        </Card>

        {!['radar-bar', 'led-flags', 'flat-flags'].includes(widgetId) && (
          <Card title={t('widgetSettings.aesthetics')}>
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <span className={styles.fieldLabel}>
                  {t('widgetSettings.background')}
                </span>
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
                <span className={styles.fieldLabel}>
                  {t('widgetSettings.border')}
                </span>
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

        {widgetId === 'rpm-lights' && <RpmLightsSettingsPanel />}
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
        {widgetId === 'race-dash' && <RaceDashSettingsPanel />}
        {widgetId === 'engine-panel' && <EnginePanelSettingsPanel />}
      </div>
    );
  }
);

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Select, Slider, Space, Switch } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import {
  panelRows,
  usePanelWidgetId,
} from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import {
  INPUT_TRACE_SETTINGS,
  STEERING_WHEEL_STYLE,
  type InputTraceSettings,
  type SteeringWheelStyle,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['input-trace'];

const { DependentBlock } = panelRows<InputTraceSettings>();
const { Row } = schemaRows(INPUT_TRACE_SETTINGS);
const { steeringZoom, historySeconds, smoothing, lineWidth } =
  INPUT_TRACE_SETTINGS.shape;

// Only the wheel arts that draw the centre-grip stripe in their own SVG
// (see wheels/gt-round.svg, wheels/flat-bottom-wheel.svg) read this color.
const STYLES_WITH_MARKER: SteeringWheelStyle[] = ['gt-round', 'flat-bottom'];

const hasSteeringMarker = (settings: InputTraceSettings): boolean =>
  settings.showSteering &&
  STYLES_WITH_MARKER.includes(settings.steeringWheelStyle);

// The default wheel draws no plate, and with nothing in the centre there is
// nothing for one to sit behind.
const hasCenterPlate = (settings: InputTraceSettings): boolean =>
  settings.showSteering &&
  settings.steeringWheelStyle !== 'default' &&
  settings.steeringCenterDisplay !== 'none';

export const InputTraceSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('input-trace');
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('widgets');

  // Lock-to-lock range describes the user's wheel rather than this widget, so
  // it is edited once in the app settings — read-only here, where it only
  // gives the zoom its real-world angle.
  const steeringLock = appSettings.appSettings.steeringLock;

  const settings = liveWidgets.getSettings<InputTraceSettings>(panelWidgetId);

  const update = (partial: Partial<InputTraceSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.inputTrace.dataChannels')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.showThrottle')}
            desc={t('settingsPanels.inputTrace.showThrottleDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.throttleColor}
                onChange={(c) => update({ throttleColor: c.toHexString() })}
              />
              <Switch
                checked={settings.showThrottle}
                onChange={(v) => update({ showThrottle: v })}
              />
            </Space>
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.showBrake')}
            desc={t('settingsPanels.inputTrace.showBrakeDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.brakeColor}
                onChange={(c) => update({ brakeColor: c.toHexString() })}
              />
              <Switch
                checked={settings.showBrake}
                onChange={(v) => update({ showBrake: v })}
              />
            </Space>
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="absColor" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.showClutch')}
            desc={t('settingsPanels.inputTrace.showClutchDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.clutchColor}
                onChange={(c) => update({ clutchColor: c.toHexString() })}
              />
              <Switch
                checked={settings.showClutch}
                onChange={(v) => update({ showClutch: v })}
              />
            </Space>
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showSteering" />
        </div>

        <DependentBlock dependsOn="showSteering">
          <SettingRow
            title={t('settingsPanels.inputTrace.steeringWheelStyle')}
            desc={t('settingsPanels.inputTrace.steeringWheelStyleDesc')}
          >
            <Select
              value={settings.steeringWheelStyle}
              options={STEERING_WHEEL_STYLE.map((styleId) => ({
                value: styleId,
                label: t(`settingsPanels.inputTrace.wheelStyles.${styleId}`),
              }))}
              onChange={(value) =>
                update({ steeringWheelStyle: value as SteeringWheelStyle })
              }
              style={{ width: 180 }}
            />
          </SettingRow>
        </DependentBlock>

        <Row setting="steeringCenterDisplay" dependsOn="showSteering" />

        <Row setting="steeringMarkerColor" dependsOn={hasSteeringMarker} />
        <Row setting="steeringCenterPlate" dependsOn={hasCenterPlate} />

        <DependentBlock dependsOn="showSteering">
          <SettingRow
            title={t('settingsPanels.inputTrace.steeringZoom')}
            desc={t('settingsPanels.inputTrace.steeringZoomDesc', {
              angle: Math.round(steeringLock / 2 / settings.steeringZoom),
              zoom: settings.steeringZoom,
              lock: steeringLock,
            })}
          >
            <Slider
              min={steeringZoom.min}
              max={steeringZoom.max}
              step={steeringZoom.step}
              value={settings.steeringZoom}
              onChange={(v) => update({ steeringZoom: v })}
              style={{ width: 120 }}
            />
          </SettingRow>
        </DependentBlock>
      </Card>

      <Card title={t('settingsPanels.inputTrace.layout')}>
        <div className={styles.fieldGroup}>
          <Row setting="showTrace" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showInputValues" />
        </div>
      </Card>

      <Card title={t('settingsPanels.inputTrace.graphSettings')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.historySeconds')}
            desc={t('settingsPanels.inputTrace.historySecondsDesc', {
              seconds: settings.historySeconds,
            })}
          >
            <Slider
              min={historySeconds.min}
              max={historySeconds.max}
              step={historySeconds.step}
              value={settings.historySeconds}
              onChange={(v) => update({ historySeconds: v })}
              style={{ width: 120 }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.smoothing')}
            desc={
              settings.smoothing === 0
                ? t('settingsPanels.inputTrace.smoothingRaw')
                : t('settingsPanels.inputTrace.smoothingFactor', {
                    factor: settings.smoothing,
                  })
            }
          >
            <Slider
              min={smoothing.min}
              max={smoothing.max}
              step={smoothing.step}
              value={settings.smoothing}
              onChange={(v) => update({ smoothing: v })}
              style={{ width: 120 }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.lineWidth')}
            desc={t('settingsPanels.inputTrace.lineWidthDesc', {
              px: settings.lineWidth,
            })}
          >
            <Slider
              min={lineWidth.min}
              max={lineWidth.max}
              step={lineWidth.step}
              value={settings.lineWidth}
              onChange={(v) => update({ lineWidth: v })}
              style={{ width: 120 }}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});

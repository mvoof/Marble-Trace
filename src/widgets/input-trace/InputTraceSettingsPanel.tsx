import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Select, Slider, Space, Switch } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { RpmZoneColorGrid } from '@features/widget-settings/RpmZoneColorGrid';
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
  isSteeringTraceShown,
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

const hasSpeedTargetColor = (settings: InputTraceSettings): boolean =>
  settings.showSpeedGear && settings.showSpeedTargetColor;

// The gear is drawn in the speed block only.
const hasGearZoneColor = (settings: InputTraceSettings): boolean =>
  settings.showSpeedGear && settings.colorizeGearByZone;

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
      <Card title={t('settingsPanels.inputTrace.layout')}>
        <div className={styles.fieldGroup}>
          <Row setting="showTrace" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showBars" />
        </div>

        <Row setting="showInputValues" dependsOn="showBars" />
      </Card>

      <Card title={t('settingsPanels.inputTrace.graphSettings')}>
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

        <DependentBlock dependsOn="showBrake">
          <SettingRow
            title={t('settingsPanels.inputTrace.showAbs')}
            desc={t('settingsPanels.inputTrace.showAbsDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.absColor}
                onChange={(c) => update({ absColor: c.toHexString() })}
              />
              <Switch
                checked={settings.showAbs}
                onChange={(v) => update({ showAbs: v })}
              />
            </Space>
          </SettingRow>
        </DependentBlock>

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
          <SettingRow
            title={t('settingsPanels.inputTrace.showSteeringTrace')}
            desc={t('settingsPanels.inputTrace.showSteeringTraceDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.steeringTraceColor}
                onChange={(c) =>
                  update({ steeringTraceColor: c.toRgbString() })
                }
              />
              <Switch
                checked={isSteeringTraceShown(settings)}
                onChange={(v) => update({ showSteeringTrace: v })}
              />
            </Space>
          </SettingRow>
        </div>

        <DependentBlock dependsOn={isSteeringTraceShown}>
          <SettingRow
            title={t('settingsPanels.inputTrace.showSlide')}
            desc={t('settingsPanels.inputTrace.showSlideDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.slideColor}
                onChange={(c) => update({ slideColor: c.toHexString() })}
              />
              <Switch
                checked={settings.showSlide}
                onChange={(v) => update({ showSlide: v })}
              />
            </Space>
          </SettingRow>
        </DependentBlock>

        <DependentBlock dependsOn={isSteeringTraceShown}>
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

      <Card title={t('settingsPanels.common.speedCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSpeedGear" />
        </div>

        <Row setting="showSpeedTargetColor" dependsOn="showSpeedGear" />
        <Row setting="speedOnTargetColor" dependsOn={hasSpeedTargetColor} />
        <Row setting="speedOverTargetColor" dependsOn={hasSpeedTargetColor} />
      </Card>

      <Card title={t('settingsPanels.common.cornerSpeedsCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showCornerSpeeds" />
        </div>

        <Row setting="entrySpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="apexSpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="exitSpeedColor" dependsOn="showCornerSpeeds" />
      </Card>

      <Card title={t('settingsPanels.common.gearRpmCard')}>
        <DependentBlock dependsOn={hasGearZoneColor}>
          <RpmZoneColorGrid
            colors={{
              rpmColorHigh: settings.rpmColorHigh,
              rpmColorShift: settings.rpmColorShift,
              rpmColorLimit: settings.rpmColorLimit,
            }}
            onChange={(key, color) => update({ [key]: color })}
          />
        </DependentBlock>

        <Row setting="colorizeGearByZone" dependsOn="showSpeedGear" />

        <Row setting="blinkAtShift" dependsOn="showSpeedGear" />
      </Card>

      <Card title={t('settingsPanels.common.steeringCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSteering" />
        </div>

        <DependentBlock dependsOn="showSteering">
          <SettingRow
            title={t('settingsPanels.common.steeringCardStyle')}
            desc={t('settingsPanels.common.steeringCardStyleDesc')}
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
      </Card>
    </>
  );
});

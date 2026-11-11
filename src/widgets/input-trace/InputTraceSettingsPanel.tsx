import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Select, Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { ColorToggleRow } from '@features/widget-settings/ColorToggleRow';
import { RpmZoneColorGrid } from '@features/widget-settings/RpmZoneColorGrid';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { panelRows } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import {
  INPUT_TRACE_SETTINGS,
  STEERING_WHEEL_STYLE,
  isSteeringTraceShown,
  type InputTraceSettings,
  type SteeringWheelStyle,
} from './settings-schema';
import { CustomWheelImageRow } from './CustomWheelImageRow';

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

const hasCustomWheel = (settings: InputTraceSettings): boolean =>
  settings.showSteering && settings.steeringWheelStyle === 'custom';

// Left and right of the graph — with no graph, or nothing to place, there is
// no side to pick.
const hasSpeedBlockSide = (settings: InputTraceSettings): boolean =>
  settings.showTrace && (settings.showSpeedGear || settings.showCornerSpeeds);

const hasSpeedTargetColor = (settings: InputTraceSettings): boolean =>
  settings.showSpeedGear && settings.showSpeedTargetColor;

// The gear is drawn in the speed block only.
const hasGearZoneColor = (settings: InputTraceSettings): boolean =>
  settings.showSpeedGear && settings.colorizeGearByZone;

export const InputTraceSettingsPanel = observer(() => {
  const [settings, update] =
    usePanelSettings<InputTraceSettings>('input-trace');
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('widgets');

  // Lock-to-lock range describes the user's wheel rather than this widget, so
  // it is edited once in the app settings — read-only here, where it only
  // gives the zoom its real-world angle.
  const steeringLock = appSettings.appSettings.steeringLock;

  return (
    <>
      <Card title={t('settingsPanels.inputTrace.layout')}>
        <div className={styles.fieldGroup}>
          <Row setting="showTrace" />
        </div>

        <Row setting="speedBlockSide" dependsOn={hasSpeedBlockSide} />

        <div className={styles.fieldGroup}>
          <Row setting="showBars" />
        </div>

        <Row setting="showInputValues" dependsOn="showBars" />
      </Card>

      <Card title={t('settingsPanels.inputTrace.graphSettings')}>
        <div className={styles.fieldGroup}>
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showThrottle')}
            desc={t('settingsPanels.inputTrace.showThrottleDesc')}
            color={settings.throttleColor}
            onColorChange={(color) => update({ throttleColor: color })}
            checked={settings.showThrottle}
            onCheckedChange={(checked) => update({ showThrottle: checked })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showBrake')}
            desc={t('settingsPanels.inputTrace.showBrakeDesc')}
            color={settings.brakeColor}
            onColorChange={(color) => update({ brakeColor: color })}
            checked={settings.showBrake}
            onCheckedChange={(checked) => update({ showBrake: checked })}
          />
        </div>

        <DependentBlock dependsOn="showBrake">
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showAbs')}
            desc={t('settingsPanels.inputTrace.showAbsDesc')}
            color={settings.absColor}
            onColorChange={(color) => update({ absColor: color })}
            checked={settings.showAbs}
            onCheckedChange={(checked) => update({ showAbs: checked })}
          />
        </DependentBlock>

        <div className={styles.fieldGroup}>
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showClutch')}
            desc={t('settingsPanels.inputTrace.showClutchDesc')}
            color={settings.clutchColor}
            onColorChange={(color) => update({ clutchColor: color })}
            checked={settings.showClutch}
            onCheckedChange={(checked) => update({ showClutch: checked })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showSteeringTrace')}
            desc={t('settingsPanels.inputTrace.showSteeringTraceDesc')}
            color={settings.steeringTraceColor}
            colorFormat="rgb"
            onColorChange={(color) => update({ steeringTraceColor: color })}
            checked={isSteeringTraceShown(settings)}
            onCheckedChange={(checked) =>
              update({ showSteeringTrace: checked })
            }
          />
        </div>

        <DependentBlock dependsOn={isSteeringTraceShown}>
          <ColorToggleRow
            title={t('settingsPanels.inputTrace.showSlide')}
            desc={t('settingsPanels.inputTrace.showSlideDesc')}
            color={settings.slideColor}
            onColorChange={(color) => update({ slideColor: color })}
            checked={settings.showSlide}
            onCheckedChange={(checked) => update({ showSlide: checked })}
          />
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

        <Row setting="colorizeGearByZone" dependsOn="showSpeedGear" />

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

        <Row setting="blinkAtShift" dependsOn="showSpeedGear" />
      </Card>

      <Card title={t('settingsPanels.common.cornerSpeedsCard')}>
        <div className={styles.fieldGroup}>
          <Row setting="showCornerSpeeds" />
        </div>

        <Row setting="entrySpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="apexSpeedColor" dependsOn="showCornerSpeeds" />
        <Row setting="exitSpeedColor" dependsOn="showCornerSpeeds" />
      </Card>

      <Card title={t('settingsPanels.common.steeringCard')}>
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

        <DependentBlock dependsOn={hasCustomWheel}>
          <CustomWheelImageRow
            image={settings.customWheelImage}
            onChange={(image) => update({ customWheelImage: image })}
          />
        </DependentBlock>

        <Row setting="steeringCenterDisplay" dependsOn="showSteering" />

        <Row setting="steeringMarkerColor" dependsOn={hasSteeringMarker} />
        <Row setting="steeringCenterPlate" dependsOn={hasCenterPlate} />
      </Card>
    </>
  );
});

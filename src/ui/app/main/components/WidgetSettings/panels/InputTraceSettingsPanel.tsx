import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Segmented, Select, Slider, Space, Switch } from 'antd';
import {
  InputTraceSettings,
  SteeringCenterDisplay,
  SteeringWheelStyle,
} from '@/types/widget-settings';
import { STEERING_WHEEL_STYLE_IDS } from '@ui/widgets/InputTraceWidget/SteeringWheel/wheel-styles';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows } from './setting-rows';
import { useAppSettingsStore } from '@store/root-store-context';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['input-trace'];

const { SwitchRow } = panelRows<InputTraceSettings>();

export const InputTraceSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('widgets');

  // Lock-to-lock range describes the user's wheel rather than this widget, so
  // it is edited once in the app settings — read-only here, where it only
  // gives the zoom its real-world angle.
  const steeringLock = appSettings.appSettings.steeringLock;

  const settings =
    widgetSettings.getSettings<InputTraceSettings>('input-trace');

  const update = (partial: Partial<InputTraceSettings>) => {
    widgetSettings.updateUserSettings('input-trace', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Card title={t('settingsPanels.inputTrace.dataChannels')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.throttle')}
            desc={t('settingsPanels.inputTrace.throttleDesc')}
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
            title={t('settingsPanels.inputTrace.brake')}
            desc={t('settingsPanels.inputTrace.brakeDesc')}
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
          <SettingRow
            title={t('settingsPanels.inputTrace.absActive')}
            desc={t('settingsPanels.inputTrace.absActiveDesc')}
          >
            <Space>
              <ColorPicker
                value={settings.absColor}
                onChange={(c) => update({ absColor: c.toHexString() })}
              />
            </Space>
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.clutch')}
            desc={t('settingsPanels.inputTrace.clutchDesc')}
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
          <SwitchRow
            settingKey="showSteering"
            title={t('settingsPanels.inputTrace.steeringWheel')}
            desc={t('settingsPanels.inputTrace.steeringWheelDesc')}
          />
        </div>

        {settings.showSteering && (
          <>
            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.wheelStyle')}
                desc={t('settingsPanels.inputTrace.wheelStyleDesc')}
              >
                <Select
                  value={settings.steeringWheelStyle}
                  options={STEERING_WHEEL_STYLE_IDS.map((styleId) => ({
                    value: styleId,
                    label: t(
                      `settingsPanels.inputTrace.wheelStyles.${styleId}`
                    ),
                  }))}
                  onChange={(value) =>
                    update({ steeringWheelStyle: value as SteeringWheelStyle })
                  }
                  style={{ width: 180 }}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.centerDisplay')}
                desc={t('settingsPanels.inputTrace.centerDisplayDesc')}
              >
                <Segmented
                  value={settings.steeringCenterDisplay}
                  options={[
                    {
                      label: t('settingsPanels.inputTrace.centerNone'),
                      value: 'none',
                    },
                    {
                      label: t('settingsPanels.inputTrace.logo'),
                      value: 'logo',
                    },
                    {
                      label: t('settingsPanels.inputTrace.gear'),
                      value: 'gear',
                    },
                    {
                      label: t('settingsPanels.inputTrace.speed'),
                      value: 'speed',
                    },
                    {
                      label: t('settingsPanels.inputTrace.angle'),
                      value: 'angle',
                    },
                    {
                      label: t('settingsPanels.inputTrace.speedGear'),
                      value: 'speed-gear',
                    },
                  ]}
                  onChange={(v) =>
                    update({
                      steeringCenterDisplay: v as SteeringCenterDisplay,
                    })
                  }
                />
              </SettingRow>
            </div>

            {settings.steeringWheelStyle !== 'default' &&
              settings.steeringCenterDisplay !== 'none' && (
                <div className={styles.fieldGroup}>
                  <SwitchRow
                    settingKey="steeringCenterPlate"
                    title={t('settingsPanels.inputTrace.centerPlate')}
                    desc={t('settingsPanels.inputTrace.centerPlateDesc')}
                  />
                </div>
              )}

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.steeringZoom')}
                desc={t('settingsPanels.inputTrace.steeringZoomDesc', {
                  angle: Math.round(
                    steeringLock / 2 / (settings.steeringZoom ?? 1)
                  ),
                  zoom: settings.steeringZoom ?? 1,
                  lock: steeringLock,
                })}
              >
                <Slider
                  min={1}
                  max={4}
                  step={0.5}
                  value={settings.steeringZoom ?? 1}
                  onChange={(v) => update({ steeringZoom: v })}
                  style={{ width: 120 }}
                />
              </SettingRow>
            </div>
          </>
        )}
      </Card>

      <Card title={t('settingsPanels.inputTrace.layout')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showTrace"
            title={t('settingsPanels.inputTrace.traceGraph')}
            desc={t('settingsPanels.inputTrace.traceGraphDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showInputValues"
            title={t('settingsPanels.inputTrace.inputValues')}
            desc={t('settingsPanels.inputTrace.inputValuesDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.inputTrace.graphSettings')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.inputTrace.historyLength')}
            desc={t('settingsPanels.inputTrace.historyLengthDesc', {
              seconds: settings.historySeconds,
            })}
          >
            <Slider
              min={1}
              max={60}
              step={1}
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
              min={0}
              max={20}
              step={1}
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
              min={1}
              max={10}
              step={0.5}
              value={settings.lineWidth}
              onChange={(v) => update({ lineWidth: v })}
              style={{ width: 120 }}
            />
          </SettingRow>
        </div>
      </Card>
    </Space>
  );
});

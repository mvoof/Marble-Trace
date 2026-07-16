import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, Segmented, Slider, Space, Switch } from 'antd';
import {
  InputTraceSettings,
  SteeringCenterDisplay,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const InputTraceSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

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
          <SettingRow
            title={t('settingsPanels.inputTrace.steeringWheel')}
            desc={t('settingsPanels.inputTrace.steeringWheelDesc')}
          >
            <Switch
              checked={settings.showSteering}
              onChange={(v) => update({ showSteering: v })}
            />
          </SettingRow>
        </div>

        {settings.showSteering && (
          <>
            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.centerDisplay')}
                desc={t('settingsPanels.inputTrace.centerDisplayDesc')}
              >
                <Segmented
                  value={settings.steeringCenterDisplay}
                  options={[
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

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.steeringLock')}
                desc={t('settingsPanels.inputTrace.steeringLockDesc', {
                  full: settings.steeringLimit,
                  half: settings.steeringLimit / 2,
                })}
              >
                <Slider
                  min={180}
                  max={1080}
                  step={90}
                  value={settings.steeringLimit}
                  onChange={(v) => update({ steeringLimit: v })}
                  style={{ width: 120 }}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.inputTrace.steeringZoom')}
                desc={t('settingsPanels.inputTrace.steeringZoomDesc', {
                  angle: Math.round(
                    settings.steeringLimit / 2 / (settings.steeringZoom ?? 1)
                  ),
                  zoom: settings.steeringZoom ?? 1,
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
          <SettingRow
            title={t('settingsPanels.inputTrace.traceGraph')}
            desc={t('settingsPanels.inputTrace.traceGraphDesc')}
          >
            <Switch
              checked={settings.showTrace}
              onChange={(v) => update({ showTrace: v })}
            />
          </SettingRow>
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

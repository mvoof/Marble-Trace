import { observer } from 'mobx-react-lite';
import { ColorPicker, Segmented, Slider, Space, Switch } from 'antd';
import {
  InputTraceSettings,
  SteeringCenterDisplay,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const InputTraceSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

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
      <Card title="Data Channels">
        <div className={styles.fieldGroup}>
          <SettingRow title="Throttle" desc="Show throttle trace on the graph.">
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
          <SettingRow title="Brake" desc="Show brake trace on the graph.">
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
            title="ABS Active"
            desc="Color of the brake trace/bar when ABS is active."
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
          <SettingRow title="Clutch" desc="Show clutch trace on the graph.">
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
            title="Steering Wheel"
            desc="Show steering wheel block and graph trace."
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
                title="Center Display"
                desc="What to show in the center of the steering wheel."
              >
                <Segmented
                  value={settings.steeringCenterDisplay}
                  options={[
                    { label: 'Logo', value: 'logo' },
                    { label: 'Gear', value: 'gear' },
                    { label: 'Speed', value: 'speed' },
                    { label: 'Angle', value: 'angle' },
                    { label: 'Spd+Gear', value: 'speed-gear' },
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
                title="Steering Lock"
                desc={`Physical range: ${settings.steeringLimit}° (±${settings.steeringLimit / 2}°)`}
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
                title="Steering Zoom"
                desc={`Graph shows ±${Math.round(settings.steeringLimit / 2 / (settings.steeringZoom ?? 1))}° (${settings.steeringZoom ?? 1}x)`}
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

      <Card title="Layout">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Trace Graph"
            desc="Show the scrolling input history graph."
          >
            <Switch
              checked={settings.showTrace}
              onChange={(v) => update({ showTrace: v })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Graph Settings">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="History Length"
            desc={`Visible history: ${settings.historySeconds}s`}
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
            title="Smoothing"
            desc={
              settings.smoothing === 0
                ? 'Raw data (60Hz)'
                : `Factor: ${settings.smoothing}`
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
            title="Line Width"
            desc={`Thickness: ${settings.lineWidth}px`}
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

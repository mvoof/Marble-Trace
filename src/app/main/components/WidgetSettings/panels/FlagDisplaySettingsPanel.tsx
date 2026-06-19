import { observer } from 'mobx-react-lite';
import { Slider, Switch } from 'antd';
import { FlagDisplaySettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: 'led-flags' | 'flat-flags' }) => {
    const widgetSettings = useWidgetSettingsStore();
    const settings = widgetSettings.getSettings<FlagDisplaySettings>(widgetId);

    const update = (partial: Partial<FlagDisplaySettings>) => {
      widgetSettings.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <Card title="Display Mode">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Always Show"
            desc="Show widget even when no flag is active."
          >
            <Switch
              checked={settings.alwaysShow}
              onChange={(v) => update({ alwaysShow: v })}
            />
          </SettingRow>
        </div>

        {!settings.alwaysShow && (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              Hold Duration: {settings.holdDuration}s
            </span>
            <div className={styles.fieldDesc}>
              How long to keep the flag visible after it clears.
            </div>
            <Slider
              min={0}
              max={30}
              step={1}
              value={settings.holdDuration}
              onChange={(v) => update({ holdDuration: v })}
            />
          </div>
        )}

        {widgetId === 'led-flags' && (
          <>
            <div className={styles.fieldGroup}>
              <SettingRow
                title="Force Single LED"
                desc="Show a single large indicator instead of the LED matrix."
              >
                <Switch
                  checked={settings.forceSingleLed ?? false}
                  onChange={(v) => update({ forceSingleLed: v })}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title="Split Display"
                desc="Split matrix into left & right parts to place around mirror."
              >
                <Switch
                  checked={settings.split ?? false}
                  onChange={(v) => update({ split: v })}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title="Animate LEDs"
                desc="Enable dynamic scrolling and waving patterns for flags."
              >
                <Switch
                  checked={settings.animate ?? true}
                  onChange={(v) => update({ animate: v })}
                />
              </SettingRow>
            </div>
          </>
        )}
      </Card>
    );
  }
);

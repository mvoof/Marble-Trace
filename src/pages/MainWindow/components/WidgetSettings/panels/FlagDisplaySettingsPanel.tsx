import { observer } from 'mobx-react-lite';
import { Slider, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { FlagDisplaySettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: 'led-flags' | 'flat-flags' }) => {
    const settings = widgetSettingsStore.getFlagDisplaySettings(widgetId);

    const update = (partial: Partial<FlagDisplaySettings>) => {
      widgetSettingsStore.updateCustomSettings(widgetId, {
        [widgetId]: { ...settings, ...partial },
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
      </Card>
    );
  }
);

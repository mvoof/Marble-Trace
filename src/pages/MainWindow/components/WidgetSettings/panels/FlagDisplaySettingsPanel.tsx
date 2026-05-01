import { observer } from 'mobx-react-lite';
import { Slider, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { FlagDisplaySettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: 'flags' | 'flat-flags' }) => {
    const settings = widgetSettingsStore.getFlagDisplaySettings(widgetId);

    const update = (partial: Partial<FlagDisplaySettings>) => {
      widgetSettingsStore.updateCustomSettings(widgetId, {
        [widgetId]: { ...settings, ...partial },
      });
    };

    return (
      <Card title="Display Mode">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Always Show</div>
              <div className={styles.fieldDesc}>
                Show widget even when no flag is active.
              </div>
            </div>
            <Switch
              checked={settings.alwaysShow}
              onChange={(v) => update({ alwaysShow: v })}
            />
          </div>
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

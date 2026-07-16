import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider, Switch } from 'antd';
import { FlagDisplaySettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: 'led-flags' | 'flat-flags' }) => {
    const widgetSettings = useWidgetEditor();
    const { t } = useTranslation('widgets');
    const settings = widgetSettings.getSettings<FlagDisplaySettings>(widgetId);

    const update = (partial: Partial<FlagDisplaySettings>) => {
      widgetSettings.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <Card title={t('settingsPanels.flagDisplay.displayMode')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.flagDisplay.alwaysShow')}
            desc={t('settingsPanels.flagDisplay.alwaysShowDesc')}
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
              {t('settingsPanels.flagDisplay.holdDuration', {
                seconds: settings.holdDuration,
              })}
            </span>
            <div className={styles.fieldDesc}>
              {t('settingsPanels.flagDisplay.holdDurationDesc')}
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
                title={t('settingsPanels.flagDisplay.forceSingleLed')}
                desc={t('settingsPanels.flagDisplay.forceSingleLedDesc')}
              >
                <Switch
                  checked={settings.forceSingleLed ?? false}
                  onChange={(v) => update({ forceSingleLed: v })}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.flagDisplay.splitDisplay')}
                desc={t('settingsPanels.flagDisplay.splitDisplayDesc')}
              >
                <Switch
                  checked={settings.split ?? false}
                  onChange={(v) => update({ split: v })}
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.flagDisplay.animateLeds')}
                desc={t('settingsPanels.flagDisplay.animateLedsDesc')}
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

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';
import { ChassisWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const ChassisSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<ChassisWidgetSettings>('chassis');

  const update = (partial: Partial<ChassisWidgetSettings>) => {
    widgetSettings.updateUserSettings('chassis', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title={t('settingsPanels.chassis.moduleLayout')}>
      <div className={styles.fieldGroup}>
        <SettingRow
          title={t('settingsPanels.chassis.suspensionAndBrakes')}
          desc={t('settingsPanels.chassis.suspensionAndBrakesDesc')}
        >
          <Switch
            checked={settings.showSuspensionAndBrakes}
            onChange={(v) => update({ showSuspensionAndBrakes: v })}
          />
        </SettingRow>
      </div>
    </Card>
  );
});

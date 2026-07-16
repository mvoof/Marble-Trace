import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, InputNumber, Segmented } from 'antd';
import {
  LinearMapOrientation,
  LinearMapWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const LinearMapSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<LinearMapWidgetSettings>('relative-map');

  const update = (partial: Partial<LinearMapWidgetSettings>) => {
    widgetSettings.updateUserSettings('relative-map', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.linearMap.moduleLayout')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.linearMap.orientation')}
          </span>
          <Segmented
            block
            value={settings.orientation}
            options={[
              {
                label: t('settingsPanels.linearMap.horizontal'),
                value: 'horizontal',
              },
              {
                label: t('settingsPanels.linearMap.vertical'),
                value: 'vertical',
              },
            ]}
            onChange={(v) => update({ orientation: v as LinearMapOrientation })}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.linearMap.playerMarker')}>
        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.linearMap.playerDotColor')}>
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </SettingRow>

          <span className={styles.fieldLabel}>
            {t('settingsPanels.linearMap.dotRadius')}
          </span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
          />
        </div>
      </Card>
    </>
  );
});

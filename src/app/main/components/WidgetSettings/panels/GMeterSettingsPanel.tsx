import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import type {
  GMeterColorMode,
  GMeterDisplayMode,
  GMeterWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';

export const GMeterSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');

  const update = (partial: Partial<GMeterWidgetSettings>) => {
    widgetSettings.updateUserSettings('g-meter', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title={t('settingsPanels.gMeter.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.gMeter.displayMode')}
        </span>
        <Segmented
          block
          value={settings.displayMode}
          options={[
            { label: t('settingsPanels.gMeter.trail'), value: 'trail' },
            { label: t('settingsPanels.gMeter.fading'), value: 'fading' },
            { label: t('settingsPanels.gMeter.peak'), value: 'peak' },
          ]}
          onChange={(v) => update({ displayMode: v as GMeterDisplayMode })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.gMeter.scale')}
        </span>
        <Segmented
          block
          value={settings.scale}
          options={[
            { label: '2G', value: 2 },
            { label: '3G', value: 3 },
            { label: '4G', value: 4 },
            { label: '5G', value: 5 },
          ]}
          onChange={(v) => update({ scale: v as 2 | 3 | 4 | 5 })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.gMeter.colorMode')}
        </span>
        <Segmented
          block
          value={settings.colorMode}
          options={[
            { label: t('settingsPanels.gMeter.mono'), value: 'mono' },
            { label: t('settingsPanels.gMeter.simple'), value: 'simple' },
            { label: t('settingsPanels.gMeter.advanced'), value: 'advanced' },
          ]}
          onChange={(v) => update({ colorMode: v as GMeterColorMode })}
        />
      </div>
    </Card>
  );
});

import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import type {
  GMeterColorMode,
  GMeterDisplayMode,
  GMeterWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const GMeterSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<GMeterWidgetSettings>('g-meter');

  const update = (partial: Partial<GMeterWidgetSettings>) => {
    widgetSettings.updateUserSettings('g-meter', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Module Parameters">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Display Mode</span>
        <Segmented
          block
          value={settings.displayMode}
          options={[
            { label: 'Trail', value: 'trail' },
            { label: 'Fading', value: 'fading' },
            { label: 'Peak', value: 'peak' },
          ]}
          onChange={(v) => update({ displayMode: v as GMeterDisplayMode })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Scale</span>
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
        <span className={styles.fieldLabel}>Color Mode</span>
        <Segmented
          block
          value={settings.colorMode}
          options={[
            { label: 'Mono', value: 'mono' },
            { label: 'Simple', value: 'simple' },
            { label: 'Advanced', value: 'advanced' },
          ]}
          onChange={(v) => update({ colorMode: v as GMeterColorMode })}
        />
      </div>
    </Card>
  );
});

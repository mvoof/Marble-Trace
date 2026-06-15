import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const SectorMatrixSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const update = (partial: Partial<SectorMatrixWidgetSettings>) => {
    widgetSettings.updateUserSettings('sector-matrix', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="Options">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Show Sector Times"
            desc="Display per-sector timing grid. Disable for a compact view with just the progress bar and lap times."
          >
            <Switch
              checked={settings.showSectors}
              onChange={(value) => update({ showSectors: value })}
            />
          </SettingRow>

          <SettingRow
            title="Show Predicted Lap"
            desc="Estimated finish time displayed in the header."
          >
            <Switch
              checked={settings.showPredicted}
              onChange={(value) => update({ showPredicted: value })}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});

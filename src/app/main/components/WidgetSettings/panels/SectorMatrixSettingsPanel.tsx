import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const SectorMatrixSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');
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
      <Card title={t('settingsPanels.sectorMatrix.options')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.sectorMatrix.showSectorTimes')}
            desc={t('settingsPanels.sectorMatrix.showSectorTimesDesc')}
          >
            <Switch
              checked={settings.showSectors}
              onChange={(value) => update({ showSectors: value })}
            />
          </SettingRow>

          <SettingRow
            title={t('settingsPanels.sectorMatrix.showPredictedLap')}
            desc={t('settingsPanels.sectorMatrix.showPredictedLapDesc')}
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

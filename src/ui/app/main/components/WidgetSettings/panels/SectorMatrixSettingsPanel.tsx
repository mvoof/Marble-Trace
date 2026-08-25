import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { SectorMatrixWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['sector-matrix'];

const { SwitchRow } = panelRows<SectorMatrixWidgetSettings>();

export const SectorMatrixSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <>
      <Card title={t('settingsPanels.sectorMatrix.options')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showSectors"
            title={t('settingsPanels.sectorMatrix.showSectorTimes')}
            desc={t('settingsPanels.sectorMatrix.showSectorTimesDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPredicted"
            title={t('settingsPanels.sectorMatrix.showPredictedLap')}
            desc={t('settingsPanels.sectorMatrix.showPredictedLapDesc')}
          />
        </div>
      </Card>
    </>
  );
});

import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import type { SectorMatrixWidgetSettings } from '@entities/widget/widget-settings';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { panelRows } from '@features/widget-settings/setting-rows';

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

        {/* Not a dependant of the sector times: the predicted lap is drawn in
            the header, which stays when the sector grid is switched off. */}
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

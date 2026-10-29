import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  CREW_RADIO_SETTINGS,
  type CrewRadioWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['crew-radio'];

const { Row } = schemaRows(CREW_RADIO_SETTINGS);

const isRecentHistory = (settings: CrewRadioWidgetSettings): boolean =>
  settings.history === 'recent';

export const CrewRadioSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.crewRadio.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <Row setting="history" />
      </div>

      <Row setting="recentCount" dependsOn={isRecentHistory} />

      <div className={styles.fieldGroup}>
        <Row setting="hideDriverLines" />
      </div>
    </Card>
  );
});

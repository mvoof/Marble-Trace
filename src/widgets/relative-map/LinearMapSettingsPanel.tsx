import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  LINEAR_MAP_SETTINGS,
  type LinearMapWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['relative-map'];

const { Row } = schemaRows(LINEAR_MAP_SETTINGS);

// The marker is always drawn — there is no switch for it — so its size and the
// pit option stand on their own; only the colour gives way to the class colour.
const isOwnPaceCarColor = (settings: LinearMapWidgetSettings): boolean =>
  !settings.paceCarUseClassColor;

export const LinearMapSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <>
      <Card title={t('settingsPanels.linearMap.moduleLayout')}>
        <div className={styles.fieldGroup}>
          <Row setting="orientation" stacked />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.playerMarker')}>
        <div className={styles.fieldGroup}>
          <Row setting="playerDotColor" />
          <Row setting="targetDotRadiusPx" stacked input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="classShapes" />
        </div>
      </Card>

      <Card title={t('settingsPanels.linearMap.incidentZones')}>
        <div className={styles.fieldGroup}>
          <Row setting="flagZoneStyle" stacked />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showIncidentZones" />
        </div>

        <Row setting="blinkIncidentZones" dependsOn="showIncidentZones" />
      </Card>

      <Card title={t('settingsPanels.common.safetyCar')}>
        <div className={styles.fieldGroup}>
          <Row setting="paceCarUseClassColor" />
        </div>

        <Row setting="paceCarColor" dependsOn={isOwnPaceCarColor} />

        <div className={styles.fieldGroup}>
          <Row setting="paceCarRadiusPx" stacked input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="paceCarShowInPits" />
        </div>
      </Card>
    </>
  );
});

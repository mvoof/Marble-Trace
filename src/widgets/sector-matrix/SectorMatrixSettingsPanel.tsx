import { observer } from 'mobx-react-lite';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { SECTOR_MATRIX_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['sector-matrix'];

const { Row } = schemaRows(SECTOR_MATRIX_SETTINGS);

export const SectorMatrixSettingsPanel = observer(() => {
  return (
    <Card group="content">
      <div className={styles.fieldGroup}>
        <Row setting="showProgress" />
        <Row setting="showSectors" />
      </div>

      {/* Not a dependant of the sector times: the predicted lap is drawn in
          the header, which stays when the sector grid is switched off. */}
      <div className={styles.fieldGroup}>
        <Row setting="predictedLap" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="lastLapChip" />
        <Row setting="bestLapChip" />
      </div>
    </Card>
  );
});

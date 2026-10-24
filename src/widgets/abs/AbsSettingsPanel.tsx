import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { ABS_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['abs'];

const { Row } = schemaRows(ABS_SETTINGS);

export const AbsSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.abs.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <Row setting="showLevel" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="hideWhenCarHasNoAbs" />
      </div>
    </Card>
  );
});

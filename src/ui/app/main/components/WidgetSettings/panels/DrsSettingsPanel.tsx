import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { DrsWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['drs'];

const { SwitchRow } = panelRows<DrsWidgetSettings>();

export const DrsSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.drs.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="hideWhenCarHasNoDrs"
          title={t('settingsPanels.drs.hideWhenCarHasNoDrs')}
          desc={t('settingsPanels.drs.hideWhenCarHasNoDrsDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="hideWhenUnavailable"
          title={t('settingsPanels.drs.hideWhenUnavailable')}
          desc={t('settingsPanels.drs.hideWhenUnavailableDesc')}
        />
      </div>
    </Card>
  );
});

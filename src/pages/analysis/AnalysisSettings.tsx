import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popover, Switch } from 'antd';
import { Settings } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import styles from './AnalysisSection.module.scss';

const ICON_SIZE = 14;

/** The gear in the Analysis title row: keep the telemetry while the game runs. */
export const AnalysisSettings = observer(() => {
  const { t } = useTranslation('main-app');
  const appSettings = useAppSettingsStore();
  const keep = appSettings.appSettings.analysisKeepWhileGameRuns;

  const content = (
    <div className={styles.settings}>
      <label className={styles.settingsRow}>
        <Switch
          size="small"
          checked={keep}
          onChange={(checked) =>
            appSettings.update({ analysisKeepWhileGameRuns: checked })
          }
        />
        {t('dataPage.analysis.keepWhileGameRuns')}
      </label>

      <p className={styles.settingsNote}>
        {t('dataPage.analysis.keepWhileGameRunsNote')}
      </p>

      <p className={styles.settingsWarning}>
        {t('dataPage.analysis.keepWhileGameRunsWarning')}
      </p>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <Button
        size="small"
        icon={<Settings size={ICON_SIZE} />}
        aria-label={t('dataPage.analysis.settings')}
      />
    </Popover>
  );
});

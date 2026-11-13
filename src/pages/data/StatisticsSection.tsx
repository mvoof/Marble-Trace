import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './DataPage.module.scss';

/** Reserved for the stats import: the `.ibt` folder, re-import, skipped files, CSV export. */
export const StatisticsSection = observer(() => {
  const { t } = useTranslation('main-app');

  return (
    <SettingsCard>
      <div className={styles.fieldTexts}>
        <div className={styles.fieldTitle}>
          {t('dataPage.statistics.comingTitle')}
        </div>

        <div className={styles.fieldDesc}>
          {t('dataPage.statistics.comingDesc')}
        </div>
      </div>
    </SettingsCard>
  );
});

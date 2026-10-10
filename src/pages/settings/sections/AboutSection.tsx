import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

// The trademark list follows the names the app itself shows; the README and
// the site footer carry their own lists for the names they use.
export const AboutSection = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  return (
    <SettingsCard title={t('settingsPage.about.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTexts}>
          <div className={styles.fieldTitle}>
            Marble Trace™{' '}
            <span className={styles.versionLabel}>
              v{appSettings.currentVersion}
            </span>
          </div>

          <div className={styles.fieldDesc}>
            {t('settingsPage.about.tagline')}
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTexts}>
          <div className={styles.fieldDesc}>
            {t('settingsPage.about.independence')}
          </div>

          <div className={`${styles.fieldDesc} ${styles.fieldDescOffset}`}>
            {t('settingsPage.about.trademarks')}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
});

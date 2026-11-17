import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Globe } from 'lucide-react';
import { useAppUpdateStore } from '@features/app-update/app-update-context';
import { useAppLinksStore } from '@features/app-links/app-links-context';
import GithubMark from '@assets/github-mark.svg?react';
import DiscordMark from '@assets/discord-mark.svg?react';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from '../SettingsPage.module.scss';

const LINK_ICON_SIZE = 14;

// The trademark list follows the names the app itself shows; the README and
// the site footer carry their own lists for the names they use.
export const AboutSection = observer(() => {
  const appUpdate = useAppUpdateStore();
  const appLinks = useAppLinksStore();
  const { t } = useTranslation('main-app');

  return (
    <SettingsCard title={t('settingsPage.about.title')}>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldTexts}>
          <div className={styles.fieldTitle}>
            Marble Trace™{' '}
            <span className={styles.versionLabel}>
              v{appUpdate.currentVersion}
            </span>
          </div>

          <div className={styles.fieldDesc}>
            {t('settingsPage.about.tagline')}
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldTexts}>
          <div className={styles.fieldTitle}>
            {t('settingsPage.about.links')}
          </div>
        </div>

        <div className={styles.linkButtons}>
          <Button
            icon={<Globe size={LINK_ICON_SIZE} />}
            onClick={() => appLinks.openWebsite()}
          >
            {t('settingsPage.about.website')}
          </Button>

          <Button
            icon={<GithubMark className={styles.linkMark} aria-hidden="true" />}
            onClick={() => appLinks.openGithub()}
          >
            GitHub
          </Button>

          <Button
            icon={
              <DiscordMark className={styles.linkMark} aria-hidden="true" />
            }
            onClick={() => appLinks.openDiscord()}
          >
            Discord
          </Button>
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

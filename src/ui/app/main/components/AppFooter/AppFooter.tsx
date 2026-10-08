import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { openExternalLink } from '@store/integrations/external-link';
import styles from './AppFooter.module.scss';

const SITE_URL = 'https://marbletrace.com/';
const GITHUB_URL = 'https://github.com/mvoof/Marble-Trace';
// Two communities: the Russian-speaking server and the international one.
const DISCORD_URL_RU = 'https://discord.gg/GVaRsHbjxV';
const DISCORD_URL_INTL = 'https://discord.gg/VXC32kNhRQ';

const handleOpen = (url: string) => openExternalLink(url);

// Slim footer: external links, and the app version on the right.
export const AppFooter = observer(() => {
  const { i18n } = useTranslation();
  const appSettings = useAppSettingsStore();

  const discordUrl = i18n.language?.toLowerCase().startsWith('ru')
    ? DISCORD_URL_RU
    : DISCORD_URL_INTL;

  const links = [
    { label: 'Site', url: SITE_URL },
    { label: 'GitHub', url: GITHUB_URL },
    { label: 'Discord', url: discordUrl },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        {links.map((link) => (
          <button
            key={link.label}
            type="button"
            className={styles.link}
            onClick={() => handleOpen(link.url)}
          >
            {link.label}
          </button>
        ))}
      </div>

      {appSettings.currentVersion && (
        <span className={styles.version}>v{appSettings.currentVersion}</span>
      )}
    </footer>
  );
});

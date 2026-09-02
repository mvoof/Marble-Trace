import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import styles from './AppFooter.module.scss';

const GITHUB_URL = 'https://github.com/mvoof/Marble-Trace';
// Two communities: the Russian-speaking server and the international one.
const DISCORD_URL_RU = 'https://discord.gg/GVaRsHbjxV';
const DISCORD_URL_INTL = 'https://discord.gg/VXC32kNhRQ';

const handleOpen = (url: string) => {
  openUrl(url).catch((error) => console.error('Failed to open URL:', error));
};

// Slim footer with external links, mirroring the lingvo-injector footer style.
export const AppFooter = () => {
  const { i18n } = useTranslation();

  const discordUrl = i18n.language?.toLowerCase().startsWith('ru')
    ? DISCORD_URL_RU
    : DISCORD_URL_INTL;

  const links = [
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
    </footer>
  );
};

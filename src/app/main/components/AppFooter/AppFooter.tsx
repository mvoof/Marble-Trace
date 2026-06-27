import { openUrl } from '@tauri-apps/plugin-opener';
import styles from './AppFooter.module.scss';

const LINKS = [
  { label: 'GitHub', url: 'https://github.com/mvoof/Marble-Trace' },
  { label: 'Discord', url: 'https://discord.gg/GVaRsHbjxV' },
];

const handleOpen = (url: string) => {
  openUrl(url).catch((error) => console.error('Failed to open URL:', error));
};

// Slim footer with external links, mirroring the lingvo-injector footer style.
export const AppFooter = () => (
  <footer className={styles.footer}>
    <div className={styles.links}>
      {LINKS.map((link) => (
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

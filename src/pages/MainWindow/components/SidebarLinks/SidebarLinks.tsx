import { Github } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import DiscordIcon from './DiscordIcon';
import styles from './SidebarLinks.module.scss';

const GITHUB_URL = 'https://github.com/mvoof/Marble-Trace';
const DISCORD_URL = 'https://discord.gg/GVaRsHbjxV';

export const SidebarLinks = () => {
  const handleOpen = (url: string) => {
    openUrl(url).catch((err) => console.error('Failed to open URL:', err));
  };

  return (
    <div className={styles.links}>
      <button
        className={styles.link}
        onClick={() => handleOpen(GITHUB_URL)}
        title="GitHub"
        aria-label="GitHub"
      >
        <Github size={16} />
      </button>
      <button
        className={styles.link}
        onClick={() => handleOpen(DISCORD_URL)}
        title="Discord"
        aria-label="Discord"
      >
        <DiscordIcon size={16} />
      </button>
    </div>
  );
};

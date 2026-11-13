import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Cast,
  Database,
  Headset,
  House,
  Keyboard,
  Layers,
  LayoutGrid,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import {
  POCKET_SECTIONS,
  type MainSection,
} from '@features/main-navigation/main-navigation.store';
import { useAppLinksStore } from '@features/app-links/app-links-context';
import { useAppUpdateStore } from '@features/app-update/app-update-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { AppStatus } from '../AppStatus/AppStatus';
import { HeaderWave } from './HeaderWave';
import { HeaderPocket } from './HeaderPocket';
import { WindowControls } from './WindowControls';
import Logo from '@assets/brand-mark.svg?react';
import DiscordMark from '@assets/discord-mark.svg?react';
import styles from './AppHeader.module.scss';

const ITEM_ICON_SIZE = 16;
const TOOL_ICON_SIZE = 16;

const SECTION_ICONS: Record<MainSection, LucideIcon> = {
  home: House,
  widgets: LayoutGrid,
  layouts: Layers,
  crew: Headset,
  connections: Cast,
  data: Database,
  hotkeys: Keyboard,
  settings: Settings,
};

/**
 * The window's title bar and its navigation: the brand on the left, the top
 * pages in the pocket, status and window buttons on the right. It shares the
 * page's background and drags the window.
 */
export const AppHeader = observer(() => {
  const navigation = useMainNavigationStore();
  const appLinks = useAppLinksStore();
  const appUpdate = useAppUpdateStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  // Elements in state, not refs: the pocket measures them in its own layout
  // effect, which runs before a parent's refs are attached.
  const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);
  const [itemsElement, setItemsElement] = useState<HTMLElement | null>(null);

  const isSettingsOpen = navigation.section === 'settings';

  return (
    <header
      ref={setHeaderElement}
      className={styles.header}
      data-tauri-drag-region
    >
      {appSettings.appSettings.headerAnimation && <HeaderWave />}

      <HeaderPocket header={headerElement} items={itemsElement} />

      <div className={styles.brand} data-tauri-drag-region>
        <span className={styles.logoTile} data-tauri-drag-region>
          <Logo className={styles.logo} aria-hidden="true" />
        </span>

        <button
          type="button"
          className={styles.brandName}
          title={t('appHeader.websiteTitle')}
          onClick={() => appLinks.openWebsite()}
        >
          Marble Trace
        </button>

        {appUpdate.currentVersion && (
          <button
            type="button"
            className={styles.versionChip}
            title={t('appHeader.releasesTitle')}
            onClick={() => appLinks.openReleases()}
          >
            v{appUpdate.currentVersion}
          </button>
        )}
      </div>

      <div className={styles.pocketSlot} data-tauri-drag-region>
        <nav
          ref={setItemsElement}
          className={styles.items}
          data-tauri-drag-region
        >
          {POCKET_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section];
            const label = t(`appHeader.sections.${section}`);
            const isActive = navigation.section === section;

            return (
              <button
                key={section}
                type="button"
                className={
                  isActive ? `${styles.item} ${styles.active}` : styles.item
                }
                title={label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigation.open(section)}
              >
                <Icon size={ITEM_ICON_SIZE} className={styles.itemIcon} />
                <span className={styles.itemLabel}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className={styles.tools} data-tauri-drag-region>
        <AppStatus />

        <button
          type="button"
          className={styles.toolButton}
          title={t('appHeader.discordTitle')}
          aria-label={t('appHeader.discordTitle')}
          onClick={() => appLinks.openDiscord()}
        >
          <DiscordMark className={styles.discordMark} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={
            isSettingsOpen
              ? `${styles.toolButton} ${styles.active}`
              : styles.toolButton
          }
          title={t('appHeader.sections.settings')}
          aria-label={t('appHeader.sections.settings')}
          aria-current={isSettingsOpen ? 'page' : undefined}
          onClick={() => navigation.open('settings')}
        >
          <Settings size={TOOL_ICON_SIZE} />
        </button>

        <WindowControls />
      </div>
    </header>
  );
});

import { makeAutoObservable } from 'mobx';
import type { AppLanguage } from '@shared/contracts/domain';
import { resolveAppLanguage } from '@entities/app-settings/app-settings.store';
import { openExternalLink } from '@shared/api/external-link';

const WEBSITE_URL = 'https://marbletrace.com/';
const GITHUB_URL = 'https://github.com/mvoof/Marble-Trace';
const RELEASES_URL = `${GITHUB_URL}/releases`;
// Two communities: the Russian-speaking server and the international one.
export const DISCORD_URL_RU = 'https://discord.gg/GVaRsHbjxV';
export const DISCORD_URL_INTL = 'https://discord.gg/VXC32kNhRQ';

type AppLinksDeps = {
  appSettings: { appSettings: { language: AppLanguage } };
};

/** The app's own places on the web, opened in the user's browser. */
export class AppLinksStore {
  constructor(private readonly deps: AppLinksDeps) {
    makeAutoObservable<this, 'deps'>(this, { deps: false }, { autoBind: true });
  }

  /** The Discord server in the app's language. */
  get discordUrl(): string {
    const language = resolveAppLanguage(
      this.deps.appSettings.appSettings.language
    );

    return language === 'ru' ? DISCORD_URL_RU : DISCORD_URL_INTL;
  }

  openWebsite() {
    openExternalLink(WEBSITE_URL);
  }

  openGithub() {
    openExternalLink(GITHUB_URL);
  }

  openReleases() {
    openExternalLink(RELEASES_URL);
  }

  openDiscord() {
    openExternalLink(this.discordUrl);
  }
}

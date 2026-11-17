import { describe, expect, it } from 'vitest';
import type { AppLanguage } from '@shared/contracts/domain';
import {
  AppLinksStore,
  DISCORD_URL_INTL,
  DISCORD_URL_RU,
} from './app-links.store';

const buildLinks = (language: AppLanguage) =>
  new AppLinksStore({ appSettings: { appSettings: { language } } });

describe('AppLinksStore', () => {
  it('sends a Russian-speaking user to the Russian Discord', () => {
    expect(buildLinks('ru').discordUrl).toBe(DISCORD_URL_RU);
  });

  it('sends everyone else to the international Discord', () => {
    expect(buildLinks('en').discordUrl).toBe(DISCORD_URL_INTL);
    expect(buildLinks('zh').discordUrl).toBe(DISCORD_URL_INTL);
  });
});

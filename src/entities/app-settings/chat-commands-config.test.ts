import { describe, expect, it } from 'vitest';

import {
  chatCommandsConfigOf,
  DEFAULT_APP_SETTINGS,
} from '@entities/app-settings/app-settings.store';

describe('chatCommandsConfigOf', () => {
  it('starts off, with fuel and the last race left out', () => {
    const config = chatCommandsConfigOf(DEFAULT_APP_SETTINGS);

    expect(config.enabled).toBe(false);
    expect(config.cooldownSeconds).toBe(10);
    expect(config.commands).not.toContain('fuel');
    expect(config.commands).not.toContain('lastrace');
    expect(config.commands).toContain('gap');
  });

  it('sends only the commands switched on', () => {
    const config = chatCommandsConfigOf({
      ...DEFAULT_APP_SETTINGS,
      streamChatCommandSwitches: {
        ...DEFAULT_APP_SETTINGS.streamChatCommandSwitches,
        gap: false,
        fuel: true,
      },
    });

    expect(config.commands).not.toContain('gap');
    expect(config.commands).toContain('fuel');
  });
});

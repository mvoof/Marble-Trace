import { describe, expect, it } from 'vitest';
import {
  CONNECTIONS_MENU,
  DEFAULT_CONNECTIONS_SECTION,
} from './connections-sections';

describe('CONNECTIONS_MENU', () => {
  it('lists browser screens, stream chat and companion apps, in that order', () => {
    expect(CONNECTIONS_MENU).toEqual([
      'browserScreens',
      'streamChat',
      'companionApps',
    ]);
  });

  it('opens on browser screens', () => {
    expect(DEFAULT_CONNECTIONS_SECTION).toBe('browserScreens');
  });
});

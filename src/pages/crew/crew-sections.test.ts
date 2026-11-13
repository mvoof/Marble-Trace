import { describe, expect, it } from 'vitest';
import { CREW_MENU, DEFAULT_CREW_SECTION } from './crew-sections';

describe('CREW_MENU', () => {
  it('lists the engineer as overview, commands, phrases and replies, packs', () => {
    expect(CREW_MENU).toEqual(['overview', 'commands', 'phrases', 'packs']);
  });

  it('opens on the overview', () => {
    expect(DEFAULT_CREW_SECTION).toBe('overview');
  });
});

import { describe, expect, it } from 'vitest';
import { MENU_SEPARATOR } from '@shared/ui/SectionedPage/section-menu';
import { settingsMenu, settingsSectionOf } from './settings-sections';

const RELEASE_MENU = [
  'general',
  'overlay',
  'interaction',
  'hotkeys',
  MENU_SEPARATOR,
  'browserScreens',
  'streamChat',
  'companionApps',
  MENU_SEPARATOR,
  'tracks',
  'strategy',
  'statistics',
  MENU_SEPARATOR,
  'updates',
  'maintenance',
  'about',
];

describe('settingsMenu', () => {
  it('lists the app, its connections, its data and its upkeep, in groups apart', () => {
    expect(settingsMenu(false)).toEqual(RELEASE_MENU);
  });

  it('adds the telemetry inspector after a separator in a build with dev tools', () => {
    expect(settingsMenu(true)).toEqual([
      ...RELEASE_MENU,
      MENU_SEPARATOR,
      'telemetryInspector',
    ]);
  });
});

describe('settingsSectionOf', () => {
  it('takes a section the menu has, else the first', () => {
    expect(settingsSectionOf('statistics')).toBe('statistics');
    expect(settingsSectionOf('nonsense')).toBe('general');
    expect(settingsSectionOf(null)).toBe('general');
  });
});

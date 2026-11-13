import { describe, expect, it } from 'vitest';
import { MENU_SEPARATOR } from '@shared/ui/SectionedPage/section-menu';
import { settingsMenu } from './settings-sections';

describe('settingsMenu', () => {
  it('lists what configures the app, in the approved order', () => {
    expect(settingsMenu(false)).toEqual([
      'general',
      'overlay',
      'interaction',
      'updates',
      'maintenance',
      'about',
    ]);
  });

  it('adds the telemetry inspector after a separator in a build with dev tools', () => {
    expect(settingsMenu(true)).toEqual([
      'general',
      'overlay',
      'interaction',
      'updates',
      'maintenance',
      'about',
      MENU_SEPARATOR,
      'telemetryInspector',
    ]);
  });
});

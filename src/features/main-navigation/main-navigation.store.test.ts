import { describe, expect, it } from 'vitest';
import { MainNavigationStore, POCKET_SECTIONS } from './main-navigation.store';

const buildNavigation = (catalogIds: string[] = ['standings', 'relative']) => {
  const crew = { dirty: false };
  const widgetDefaults = { catalogWidgets: catalogIds.map((id) => ({ id })) };
  const navigation = new MainNavigationStore({
    voiceCrew: crew,
    widgetDefaults,
  });

  return { navigation, crew };
};

describe('MainNavigationStore', () => {
  it('opens on the home page', () => {
    const { navigation } = buildNavigation();

    expect(navigation.section).toBe('home');
  });

  it('lists the seven top pages in the pocket, settings outside it', () => {
    expect(POCKET_SECTIONS).toEqual([
      'home',
      'widgets',
      'layouts',
      'crew',
      'connections',
      'data',
      'hotkeys',
    ]);
  });

  it('opens a feature page', () => {
    const { navigation } = buildNavigation();

    navigation.open('hotkeys');

    expect(navigation.section).toBe('hotkeys');
  });

  it('switches to the page it is asked for', () => {
    const { navigation } = buildNavigation();

    navigation.open('settings');

    expect(navigation.section).toBe('settings');
  });

  it('shows the first catalog widget until one is chosen', () => {
    const { navigation } = buildNavigation();

    expect(navigation.activeWidgetId).toBe('standings');
  });

  it('has no widget to show when the catalog is empty', () => {
    const { navigation } = buildNavigation([]);

    expect(navigation.activeWidgetId).toBeNull();
  });

  it('opens the widgets page on the widget it is asked for', () => {
    const { navigation } = buildNavigation();

    navigation.openWidget('relative');

    expect(navigation.section).toBe('widgets');
    expect(navigation.activeWidgetId).toBe('relative');
  });

  it('keeps the chosen widget when the widgets page is opened again', () => {
    const { navigation } = buildNavigation();

    navigation.openWidget('relative');
    navigation.open('settings');
    navigation.open('widgets');

    expect(navigation.activeWidgetId).toBe('relative');
  });

  describe('leaving the crew page with unsaved edits', () => {
    const buildOnDirtyCrew = () => {
      const built = buildNavigation();

      built.navigation.open('crew');
      built.crew.dirty = true;

      return built;
    };

    it('asks first instead of leaving', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.open('settings');

      expect(navigation.section).toBe('crew');
      expect(navigation.isAskingToLeave).toBe(true);
    });

    it('stays on the crew page when told to stay', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.open('settings');
      navigation.stay();

      expect(navigation.section).toBe('crew');
      expect(navigation.isAskingToLeave).toBe(false);
    });

    it('goes where it was asked once told to leave', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.open('settings');
      navigation.leave();

      expect(navigation.section).toBe('settings');
      expect(navigation.isAskingToLeave).toBe(false);
    });

    it('opens the asked-for widget once told to leave', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.openWidget('relative');

      expect(navigation.activeWidgetId).toBe('standings');

      navigation.leave();

      expect(navigation.section).toBe('widgets');
      expect(navigation.activeWidgetId).toBe('relative');
    });

    it('drops the asked-for widget when told to stay', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.openWidget('relative');
      navigation.stay();

      expect(navigation.activeWidgetId).toBe('standings');
    });

    it('does not ask when the crew page is opened again', () => {
      const { navigation } = buildOnDirtyCrew();

      navigation.open('crew');

      expect(navigation.isAskingToLeave).toBe(false);
    });
  });

  it('leaves the crew page without asking when nothing is unsaved', () => {
    const { navigation } = buildNavigation();

    navigation.open('crew');
    navigation.open('settings');

    expect(navigation.section).toBe('settings');
    expect(navigation.isAskingToLeave).toBe(false);
  });

  it('does not ask on other pages while the crew holds edits', () => {
    const { navigation, crew } = buildNavigation();

    crew.dirty = true;
    navigation.open('settings');

    expect(navigation.section).toBe('settings');
  });
});

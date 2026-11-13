import { hasDevTools } from './dev-tools';

/**
 * The settings navigation tree. One flat page of eleven cards made everything
 * equally hard to find, so the cards are split into sections and the sections
 * grouped; the nav shows the groups, the pane shows one section.
 */
export type SettingsSectionId =
  | 'general'
  | 'updates'
  | 'about'
  | 'companionApps'
  | 'overlay'
  | 'interaction'
  | 'bindings'
  | 'devices'
  | 'trackMap'
  | 'sharedValues'
  | 'streamChat'
  | 'remoteScreens'
  | 'maintenance'
  | 'telemetryInspector';

export interface SettingsGroup {
  /** i18n key under `settingsPage.nav.groups`. */
  id: string;
  sections: SettingsSectionId[];
}

/** Only what configures the app itself; the rest lives on the feature pages. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { id: 'application', sections: ['general', 'updates', 'about'] },
  { id: 'overlay', sections: ['overlay', 'interaction'] },
  // The inspector is a developer tool and is left out of a release build.
  {
    id: 'maintenance',
    sections: hasDevTools
      ? ['maintenance', 'telemetryInspector']
      : ['maintenance'],
  },
];

export type FeaturePage = 'connections' | 'data' | 'hotkeys';

/**
 * The sections each feature page shows, one under another, until the page is
 * given an inner menu of its own.
 */
export const FEATURE_PAGE_SECTIONS: Record<FeaturePage, SettingsSectionId[]> = {
  connections: ['remoteScreens', 'streamChat', 'companionApps'],
  data: ['trackMap', 'sharedValues'],
  hotkeys: ['bindings', 'devices'],
};

export const isFeaturePage = (page: string): page is FeaturePage =>
  Object.hasOwn(FEATURE_PAGE_SECTIONS, page);

export const DEFAULT_SECTION: SettingsSectionId = 'general';

export const groupOfSection = (section: SettingsSectionId): string =>
  SETTINGS_GROUPS.find((group) => group.sections.includes(section))?.id ??
  SETTINGS_GROUPS[0].id;

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

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'application',
    sections: ['general', 'companionApps', 'updates', 'about'],
  },
  { id: 'overlay', sections: ['overlay', 'interaction'] },
  { id: 'controls', sections: ['bindings', 'devices'] },
  // Widget data: what the widgets draw from, and the values several of them
  // read at once. The chat is not either of those — it is a source of its own,
  // wired to an account rather than to a session, so it keeps its own group.
  { id: 'data', sections: ['trackMap', 'sharedValues'] },
  { id: 'chat', sections: ['streamChat'] },
  { id: 'remote', sections: ['remoteScreens'] },
  // The inspector is a developer tool and is left out of a release build.
  {
    id: 'maintenance',
    sections: hasDevTools
      ? ['maintenance', 'telemetryInspector']
      : ['maintenance'],
  },
];

export const DEFAULT_SECTION: SettingsSectionId = 'general';

export const groupOfSection = (section: SettingsSectionId): string =>
  SETTINGS_GROUPS.find((group) => group.sections.includes(section))?.id ??
  SETTINGS_GROUPS[0].id;

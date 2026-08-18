/**
 * The settings navigation tree. One flat page of eleven cards made everything
 * equally hard to find, so the cards are split into sections and the sections
 * grouped; the nav shows the groups, the pane shows one section.
 */
export type SettingsSectionId =
  | 'general'
  | 'updates'
  | 'overlay'
  | 'interaction'
  | 'bindings'
  | 'devices'
  | 'trackMap'
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
  { id: 'application', sections: ['general', 'updates'] },
  { id: 'overlay', sections: ['overlay', 'interaction'] },
  { id: 'controls', sections: ['bindings', 'devices'] },
  { id: 'data', sections: ['trackMap', 'streamChat'] },
  { id: 'remote', sections: ['remoteScreens'] },
  { id: 'maintenance', sections: ['maintenance', 'telemetryInspector'] },
];

export const DEFAULT_SECTION: SettingsSectionId = 'general';

export const groupOfSection = (section: SettingsSectionId): string =>
  SETTINGS_GROUPS.find((group) => group.sections.includes(section))?.id ??
  SETTINGS_GROUPS[0].id;

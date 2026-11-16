import {
  MENU_SEPARATOR,
  type SectionMenuEntry,
} from '@shared/ui/SectionedPage/section-menu';
import { hasDevTools } from './dev-tools';

/** Every section the Settings page draws. */
export type SettingsSectionId =
  | 'general'
  | 'updates'
  | 'about'
  | 'overlay'
  | 'interaction'
  | 'hotkeys'
  | 'browserScreens'
  | 'streamChat'
  | 'otherApps'
  | 'tracks'
  | 'widgetSettings'
  | 'telemetryFiles'
  | 'maintenance'
  | 'telemetryInspector';

/** What sets up the app and how it is driven. */
const APP_SECTIONS = [
  'general',
  'overlay',
  'interaction',
  'hotkeys',
] as const satisfies readonly SettingsSectionId[];

/** What reaches outside the PC's own screens. */
const CONNECTION_SECTIONS = [
  'browserScreens',
  'streamChat',
  'otherApps',
] as const satisfies readonly SettingsSectionId[];

/** What the app holds for the driver: recorded tracks, widget settings, telemetry files. */
const DATA_SECTIONS = [
  'tracks',
  'widgetSettings',
  'telemetryFiles',
] as const satisfies readonly SettingsSectionId[];

/** Keeping the app itself: updates, resets, what it is. */
const UPKEEP_SECTIONS = [
  'updates',
  'maintenance',
  'about',
] as const satisfies readonly SettingsSectionId[];

/** What the Settings page shows in its menu. */
export type SettingsMenuSectionId =
  | (typeof APP_SECTIONS)[number]
  | (typeof CONNECTION_SECTIONS)[number]
  | (typeof DATA_SECTIONS)[number]
  | (typeof UPKEEP_SECTIONS)[number]
  | 'telemetryInspector';

/**
 * The Settings page's inner menu, four groups apart. The telemetry inspector
 * is a developer tool: set apart below a separator, and left out of a release
 * build.
 */
export const settingsMenu = (
  withDevTools: boolean
): SectionMenuEntry<SettingsMenuSectionId>[] => {
  const menu: SectionMenuEntry<SettingsMenuSectionId>[] = [
    ...APP_SECTIONS,
    MENU_SEPARATOR,
    ...CONNECTION_SECTIONS,
    MENU_SEPARATOR,
    ...DATA_SECTIONS,
    MENU_SEPARATOR,
    ...UPKEEP_SECTIONS,
  ];

  return withDevTools ? [...menu, MENU_SEPARATOR, 'telemetryInspector'] : menu;
};

export const SETTINGS_MENU = settingsMenu(hasDevTools);

export const DEFAULT_SETTINGS_SECTION: SettingsMenuSectionId = 'general';

/** A section the navigation names, if the menu has it; else the first. */
export const settingsSectionOf = (
  section: string | null
): SettingsMenuSectionId =>
  SETTINGS_MENU.find(
    (entry): entry is SettingsMenuSectionId => entry === section
  ) ?? DEFAULT_SETTINGS_SECTION;

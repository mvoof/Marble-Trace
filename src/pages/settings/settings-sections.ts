import {
  MENU_SEPARATOR,
  type SectionMenuEntry,
} from '@shared/ui/SectionedPage/section-menu';
import { hasDevTools } from './dev-tools';

/** Every section the settings and the feature pages draw. */
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

/** The app's own settings, in the order the inner menu lists them. */
const SETTINGS_SECTIONS = [
  'general',
  'overlay',
  'interaction',
  'updates',
  'maintenance',
  'about',
] as const satisfies readonly SettingsSectionId[];

/** What the Settings page itself shows; the rest lives on the feature pages. */
export type SettingsMenuSectionId =
  | (typeof SETTINGS_SECTIONS)[number]
  | 'telemetryInspector';

/**
 * The Settings page's inner menu. The telemetry inspector is a developer tool:
 * set apart below a separator, and left out of a release build.
 */
export const settingsMenu = (
  withDevTools: boolean
): SectionMenuEntry<SettingsMenuSectionId>[] =>
  withDevTools
    ? [...SETTINGS_SECTIONS, MENU_SEPARATOR, 'telemetryInspector']
    : [...SETTINGS_SECTIONS];

export const SETTINGS_MENU = settingsMenu(hasDevTools);

export const DEFAULT_SETTINGS_SECTION: SettingsMenuSectionId = 'general';

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

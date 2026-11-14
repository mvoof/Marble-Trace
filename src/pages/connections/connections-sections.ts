/** What reaches outside the PC's own screens, in the order the menu lists it. */
export const CONNECTIONS_MENU = [
  'browserScreens',
  'streamChat',
  'companionApps',
] as const;

export type ConnectionsSectionId = (typeof CONNECTIONS_MENU)[number];

export const DEFAULT_CONNECTIONS_SECTION: ConnectionsSectionId =
  'browserScreens';

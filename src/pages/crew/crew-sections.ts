/** The engineer's sections, in the order the menu lists them. */
export const CREW_MENU = [
  'overview',
  'downloads',
  'commands',
  'phrases',
  'packs',
] as const;

export type CrewSectionId = (typeof CREW_MENU)[number];

export const DEFAULT_CREW_SECTION: CrewSectionId = 'overview';

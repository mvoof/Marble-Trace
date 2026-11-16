/** What the app holds for the driver, in the order the menu lists it. */
export const DATA_MENU = ['tracks', 'strategy', 'statistics'] as const;

export type DataSectionId = (typeof DATA_MENU)[number];

export const DEFAULT_DATA_SECTION: DataSectionId = 'tracks';

/** A section the navigation names, if the menu has it; else the first. */
export const dataSectionOf = (section: string | null): DataSectionId =>
  DATA_MENU.find((id) => id === section) ?? DEFAULT_DATA_SECTION;

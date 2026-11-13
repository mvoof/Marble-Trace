/** What the app holds for the driver, in the order the menu lists it. */
export const DATA_MENU = ['tracks', 'strategy', 'statistics'] as const;

export type DataSectionId = (typeof DATA_MENU)[number];

export const DEFAULT_DATA_SECTION: DataSectionId = 'tracks';

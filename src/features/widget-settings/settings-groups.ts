/**
 * The settings groups every widget page shares, in the order they are drawn.
 * A widget uses only the ones it needs; its own blocks (free names, e.g.
 * "Badges") sit between the lead group and Display.
 */
export const SETTINGS_GROUPS = [
  'columns',
  'content',
  'display',
  'size',
  'background',
  'behaviour',
] as const;

export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

// The place of a widget's own block: after Columns / Content, before Display.
export const OWN_BLOCK_ORDER = 1;

const GROUP_ORDER: Record<SettingsGroup, number> = {
  columns: 0,
  content: 0,
  display: 2,
  size: 3,
  background: 4,
  behaviour: 5,
};

/** Where a card sits among its panel's cards (the flex `order`). */
export const settingsGroupOrder = (group: SettingsGroup | undefined): number =>
  group === undefined ? OWN_BLOCK_ORDER : GROUP_ORDER[group];

// Titles that name a group without being it: a block called so is either one
// of the groups (and says so with `group`) or a block of the widget's own with
// a name of its own. Matched against the whole English title.
const SYNONYM_TITLES = [
  /^view$/,
  /^appearance$/,
  /^aesthetics$/,
  /^look$/,
  /^styles?$/,
  /^styling$/,
  /^visuals?$/,
  /^layout( & dimensions)?$/,
  /^dimensions$/,
  /^options$/,
  /^settings$/,
  /^general$/,
  /^parameters$/,
  /^module (parameters|layout)$/,
  /^visibility$/,
  /^appears when$/,
  /^(visible|visual) elements$/,
  /^elements$/,
  /^colou?rs$/,
  /^theme$/,
  /^data columns$/,
  /\bbehaviou?r$/,
];

// The English names of the groups, and the other spelling of one.
const GROUP_TITLES = new Set<string>([...SETTINGS_GROUPS, 'behavior']);

/**
 * Why a card may not carry this English title, or null when it may. A group's
 * own name is refused too: a group card is declared with `group`, which spells
 * the name the same way in every panel and puts the card in its place.
 */
export const forbiddenTitleReason = (englishTitle: string): string | null => {
  const title = englishTitle.trim().toLowerCase();

  if (GROUP_TITLES.has(title)) {
    return `"${englishTitle}" is a group — use <Card group=…>`;
  }

  if (SYNONYM_TITLES.some((pattern) => pattern.test(title))) {
    return `"${englishTitle}" is a synonym of a group — use the group, or name the block`;
  }

  return null;
};

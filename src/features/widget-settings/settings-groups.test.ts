import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import enWidgets from '../../locales/en/widgets.json';
import {
  SETTINGS_GROUPS,
  forbiddenTitleReason,
  settingsGroupOrder,
} from './settings-groups';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const panelSources = (): Record<string, string> =>
  Object.fromEntries(
    readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('SettingsPanel.tsx'))
      .map((file) => [
        basename(file),
        readFileSync(join(SRC_DIR, file), 'utf8'),
      ])
  );

const englishOf = (key: string): string | undefined => {
  let node: unknown = enWidgets;

  for (const part of key.split('.')) {
    node =
      typeof node === 'object' && node !== null
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }

  return typeof node === 'string' ? node : undefined;
};

// `<Card title={t('settingsPanels.x.y')}` — every titled card in the kit's panels.
const CARD_TITLE_KEY = /<Card\b[^>]*?\btitle=\{t\(\s*['"]([^'"]+)['"]/g;

// Any titled card at all: one the pattern above cannot read escapes the check.
const CARD_WITH_TITLE = /<Card\b[^>]*?\btitle=/g;

const titleProblems = (source: string): string[] => {
  const keyed = [...source.matchAll(CARD_TITLE_KEY)];
  const unread =
    [...source.matchAll(CARD_WITH_TITLE)].length === keyed.length
      ? []
      : ["a card's title is not a literal t('…') key the check can read"];

  return [
    ...unread,
    ...keyed.flatMap(([, key]) => {
      const english = englishOf(key);

      if (english === undefined) {
        return [`${key} has no English string`];
      }

      const reason = forbiddenTitleReason(english);

      return reason === null ? [] : [`${key}: ${reason}`];
    }),
  ];
};

describe('forbiddenTitleReason', () => {
  it('refuses the synonyms of a group', () => {
    for (const title of [
      'View',
      'Appearance',
      'Module parameters',
      'Visibility',
      'Radar Behavior',
      'Data Columns',
      'Visible Elements',
    ]) {
      expect(forbiddenTitleReason(title), title).not.toBeNull();
    }
  });

  it('refuses a group named by hand', () => {
    expect(forbiddenTitleReason('Display')).not.toBeNull();
    expect(forbiddenTitleReason('Behaviour')).not.toBeNull();
  });

  it('lets a block of the widget its own name', () => {
    for (const title of ['Badges', 'View Mode', 'Scope', 'Header Info']) {
      expect(forbiddenTitleReason(title), title).toBeNull();
    }
  });
});

describe('settings group order', () => {
  it('draws Columns / Content, own blocks, Display, Size, Background, Behaviour', () => {
    const orders = [
      settingsGroupOrder('columns'),
      settingsGroupOrder('content'),
      settingsGroupOrder(undefined),
      settingsGroupOrder('display'),
      settingsGroupOrder('size'),
      settingsGroupOrder('background'),
      settingsGroupOrder('behaviour'),
      settingsGroupOrder('hotkeys'),
    ];

    expect(orders).toEqual([...orders].sort((left, right) => left - right));
    expect(settingsGroupOrder('columns')).toBeLessThan(
      settingsGroupOrder(undefined)
    );
    expect(SETTINGS_GROUPS).toHaveLength(7);
  });
});

describe('widget settings panels', () => {
  const sources = panelSources();

  it('finds the panels', () => {
    expect(Object.keys(sources)).toContain('StandingsSettingsPanel.tsx');
  });

  it('title no card with a synonym of a group', () => {
    const problems = Object.entries(sources).flatMap(([file, source]) =>
      titleProblems(source).map((problem) => `${file} — ${problem}`)
    );

    expect(problems).toEqual([]);
  });
});

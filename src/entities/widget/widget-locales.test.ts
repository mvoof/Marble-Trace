import { describe, expect, it } from 'vitest';

import { WIDGETS } from '@entities/widget/widget-catalog';
import en from '@/locales/en/widgets.json';
import es from '@/locales/es/widgets.json';
import ru from '@/locales/ru/widgets.json';
import zh from '@/locales/zh/widgets.json';

// A widget's strings live in the shared locale files, not in its folder, so
// deleting the folder leaves them behind without breaking anything. This is
// what finds them: every block has to belong to a widget the catalog ships.
const LANGUAGES = { en, es, ru, zh };

/**
 * The widget list clamps a description to three lines, about 95 characters at
 * its width; this leaves room for the widest script. One short sentence, two
 * at most — the settings panel is where a widget explains itself.
 */
const MAX_CATALOG_DESCRIPTION_LENGTH = 80;

/** Strings several widgets share; owned by none of them. */
const SHARED_BLOCKS = new Set(['common']);

const widgetIds = new Set(WIDGETS.map((manifest) => manifest.id));
const localeBlocks = new Set(
  WIDGETS.map((manifest) => manifest.settingsSchema.localeBlock)
);

const strayKeys = (keys: string[], owners: ReadonlySet<string>): string[] =>
  keys.filter((key) => !owners.has(key));

const keyPaths = (strings: object, prefix = ''): string[] =>
  Object.entries(strings).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keyPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );

describe('widget locale strings', () => {
  // A panel row reads its title and description by the setting key, so a key
  // one language lacks shows the raw key there instead of a fallback.
  it.each(Object.entries(LANGUAGES))(
    'gives every settings string in every language (%s)',
    (_language, strings) => {
      expect(keyPaths(strings.settingsPanels).sort()).toEqual(
        keyPaths(en.settingsPanels).sort()
      );
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'keeps no settings block of a widget the catalog does not ship (%s)',
    (_language, strings) => {
      const owners = new Set([...localeBlocks, ...SHARED_BLOCKS]);

      expect(strayKeys(Object.keys(strings.settingsPanels), owners)).toEqual(
        []
      );
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'keeps every catalog description short enough to show whole (%s)',
    (_language, strings) => {
      const tooLong = Object.entries(strings.catalog)
        .filter(
          ([, entry]) =>
            entry.description.length > MAX_CATALOG_DESCRIPTION_LENGTH
        )
        .map(([id, entry]) => `${id} (${entry.description.length})`);

      expect(tooLong).toEqual([]);
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'keeps no catalog entry of a widget the catalog does not ship (%s)',
    (_language, strings) => {
      expect(strayKeys(Object.keys(strings.catalog), widgetIds)).toEqual([]);
    }
  );
});

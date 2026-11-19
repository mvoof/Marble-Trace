import { describe, expect, it } from 'vitest';

import en from '@/locales/en/main-app.json';
import es from '@/locales/es/main-app.json';
import ru from '@/locales/ru/main-app.json';
import zh from '@/locales/zh/main-app.json';
import de from '@/locales/de/main-app.json';
import fr from '@/locales/fr/main-app.json';
import ptBR from '@/locales/pt-BR/main-app.json';

const LANGUAGES = { en, es, ru, zh, de, fr, 'pt-BR': ptBR };
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const leafEntries = (strings: object, prefix = ''): Array<[string, string]> =>
  Object.entries(strings).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? leafEntries(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value as string]]
  );

const keyPaths = (strings: object): string[] =>
  leafEntries(strings)
    .map(([key]) => key)
    .filter((key) => !PLURAL_SUFFIX.test(key))
    .sort();

const placeholders = (translation: string): string[] =>
  [...translation.matchAll(/\{\{[^}]+\}\}/g)]
    .map(([placeholder]) => placeholder)
    .sort();

describe('main app locale strings', () => {
  it.each(Object.entries(LANGUAGES))(
    'has every main app string in every language (%s)',
    (_language, strings) => {
      expect(keyPaths(strings)).toEqual(keyPaths(en));
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'has the plural forms required by each language (%s)',
    (language, strings) => {
      const sourcePluralGroups = new Set(
        leafEntries(en)
          .map(([key]) => key)
          .filter((key) => PLURAL_SUFFIX.test(key))
          .map((key) => key.replace(PLURAL_SUFFIX, ''))
      );
      const translatedKeys = new Set(leafEntries(strings).map(([key]) => key));
      const pluralRules = new Intl.PluralRules(language);
      const relevantCategories = new Set(
        Array.from({ length: 201 }, (_, count) => pluralRules.select(count))
      );
      relevantCategories.add('other');
      const requiredForms = [...relevantCategories].flatMap((category) =>
        [...sourcePluralGroups].map((key) => `${key}_${category}`)
      );

      expect(requiredForms.filter((key) => !translatedKeys.has(key))).toEqual(
        []
      );
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'keeps every interpolation placeholder intact (%s)',
    (_language, strings) => {
      const sourceEntries = Object.fromEntries(leafEntries(en));
      const translatedEntries = Object.fromEntries(leafEntries(strings));
      const mismatchedKeys = Object.keys(sourceEntries).filter(
        (key) =>
          key in translatedEntries &&
          JSON.stringify(placeholders(sourceEntries[key])) !==
            JSON.stringify(placeholders(translatedEntries[key]))
      );

      expect(mismatchedKeys).toEqual([]);
    }
  );

  it.each(Object.entries(LANGUAGES))(
    'has no empty main app translations (%s)',
    (_language, strings) => {
      const emptyKeys = leafEntries(strings)
        .filter(([, value]) => value.trim().length === 0)
        .map(([key]) => key);

      expect(emptyKeys).toEqual([]);
    }
  );
});

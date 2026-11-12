import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DEFAULT_WIDGETS } from './widget/widget-catalog';

// A widget is its slice: what is particular to one widget lives in its
// manifest, and the entities below it hold no branch on a widget's type. A
// string naming a catalog widget in `entities/` is that branch. The ones left
// are listed with why; a new one is a decision, not a default.
const NAMED_EXCEPTIONS: Record<string, string> = {
  'flags/flags.store.ts':
    'the flag store follows the Flat Flags settings for which flags to raise',
  'radar/radar.store.ts':
    'the radar store owns the show/hide timing of both radar widgets',
  'widget/widget-placement.ts':
    'the starter layout places the first widgets a new user sees',
};

const ENTITIES_DIR = dirname(fileURLToPath(import.meta.url));

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm;
// A quoted word not closing a type argument (`makeAutoObservable<Store, 'timer'>`).
const STRING_LITERAL = /(['"`])([a-z][a-z0-9-]*)\1(?!\s*>)/g;

const isSourceFile = (file: string): boolean =>
  /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$/.test(file);

const sourceFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
    .filter(isSourceFile);

const widgetNamesIn = (source: string, widgetIds: Set<string>): string[] => {
  const code = source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1');
  const named = new Set<string>();

  for (const match of code.matchAll(STRING_LITERAL)) {
    if (widgetIds.has(match[2])) {
      named.add(match[2]);
    }
  }

  return [...named];
};

describe('entities name no widget', () => {
  const widgetIds = new Set(DEFAULT_WIDGETS.map((widget) => widget.type));
  const files = sourceFilesUnder(ENTITIES_DIR);

  it('finds the catalog', () => {
    expect(widgetIds.size).toBeGreaterThan(20);
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.filter((file) => !(file in NAMED_EXCEPTIONS)))(
    '%s names no widget',
    (file) => {
      const source = readFileSync(join(ENTITIES_DIR, file), 'utf8');

      expect(widgetNamesIn(source, widgetIds)).toEqual([]);
    }
  );

  it.each(Object.keys(NAMED_EXCEPTIONS))(
    'the exception %s still names one',
    (file) => {
      const source = readFileSync(join(ENTITIES_DIR, file), 'utf8');

      expect(widgetNamesIn(source, widgetIds)).not.toEqual([]);
    }
  );
});

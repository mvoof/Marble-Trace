import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The catalogue is a hand-written page over a generated skeleton: the line
 * beside each entry is the whole value and nothing can infer it, but the list of
 * entries can rot the week it is written. So the list is checked against the
 * tree — a module added next month fails here instead of quietly making the page
 * a lie.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS_DIR = join(REPO_ROOT, 'docs');

const catalogue = readFileSync(join(DOCS_DIR, 'widget-toolbox.md'), 'utf8');

/** A module counts as listed when its name appears in a code span on the page. */
const isListed = (moduleName: string): boolean =>
  catalogue.includes(`\`${moduleName}\``);

const isTestFile = (fileName: string): boolean =>
  fileName.includes('.test.') || fileName.includes('.stories.');

/** Every non-test `.ts` under a flat folder, by file name. */
const modulesIn = (relativeFolder: string): string[] =>
  readdirSync(join(REPO_ROOT, relativeFolder), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith('.ts') && !isTestFile(entry.name)
    )
    .map((entry) => entry.name);

/** Shared components are a folder each, plus the odd single file. */
const sharedComponents = (): string[] =>
  readdirSync(join(REPO_ROOT, 'src/ui/shared'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() ||
        (entry.name.endsWith('.tsx') && !isTestFile(entry.name))
    )
    .map((entry) => entry.name);

describe('the widget toolbox catalogue', () => {
  it('found the trees it checks against', () => {
    // A folder that silently read as empty would make every check below pass.
    expect(modulesIn('src/utils').length).toBeGreaterThan(0);
    expect(sharedComponents().length).toBeGreaterThan(0);
    expect(modulesIn('src/ui/hooks').length).toBeGreaterThan(0);
  });

  it('lists every pure helper in src/utils/', () => {
    const missing = modulesIn('src/utils').filter(
      (moduleName) => !isListed(moduleName)
    );

    expect(missing).toEqual([]);
  });

  it('lists every shared component in src/ui/shared/', () => {
    const missing = sharedComponents().filter(
      (component) => !isListed(component)
    );

    expect(missing).toEqual([]);
  });

  it('lists every shared hook in src/ui/hooks/', () => {
    const missing = modulesIn('src/ui/hooks')
      .map((fileName) => fileName.replace(/\.ts$/, ''))
      .filter((hookName) => !isListed(hookName));

    expect(missing).toEqual([]);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A route whose links have rotted is worse than no route, because it is followed
 * anyway. Every relative path and anchor the route and the catalogue point at
 * has to resolve, and this checks it rather than someone.
 */

const DOCS_DIR = dirname(fileURLToPath(import.meta.url));

const PAGES = ['widget-authoring.md', 'widget-toolbox.md'];

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** GitHub's slug: lowercase, punctuation dropped, spaces to hyphens. */
const slugify = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const anchorsOf = (filePath: string): Set<string> => {
  const headings = readFileSync(filePath, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm);

  return new Set([...headings].map((match) => slugify(match[1])));
};

interface Link {
  page: string;
  target: string;
}

const linksOf = (page: string): Link[] => {
  const body = readFileSync(join(DOCS_DIR, page), 'utf8');

  return [...body.matchAll(MARKDOWN_LINK)]
    .map((match) => ({ page, target: match[1] }))
    .filter(
      ({ target }) => !target.startsWith('http') && !target.startsWith('#')
    );
};

const allLinks = PAGES.flatMap(linksOf);

describe('the route links', () => {
  it('points at pages that exist', () => {
    const broken = allLinks.filter(({ target }) => {
      const [filePart] = target.split('#');

      return !existsSync(resolve(DOCS_DIR, filePart));
    });

    expect(broken).toEqual([]);
  });

  it('points at anchors that exist', () => {
    const broken = allLinks.filter(({ target }) => {
      const [filePart, anchor] = target.split('#');

      if (anchor === undefined) {
        return false;
      }

      const filePath = resolve(DOCS_DIR, filePart);

      return existsSync(filePath) && !anchorsOf(filePath).has(anchor);
    });

    expect(broken).toEqual([]);
  });

  it('is reachable from the files an author already opens', () => {
    const agents = readFileSync(resolve(DOCS_DIR, '../AGENTS.md'), 'utf8');
    const contributing = readFileSync(
      resolve(DOCS_DIR, '../CONTRIBUTING.md'),
      'utf8'
    );

    expect(agents).toContain('docs/widget-authoring.md');
    expect(contributing).toContain('docs/widget-authoring.md');
  });
});

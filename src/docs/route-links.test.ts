import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A route whose links have rotted is worse than no route, because it is followed
 * anyway. Every relative path and anchor the route, the catalogue and the doc
 * indexes point at has to resolve, and this checks it rather than someone.
 */

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..');

const PAGES = [
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/telemetry-tapes.md',
  'docs/widget-authoring.md',
  'docs/widget-screenshots.md',
  'docs/widget-toolbox.md',
];

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/** GitHub's slug: lowercase, punctuation dropped, each space to a hyphen. */
const slugify = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');

const anchorsOf = (filePath: string): Set<string> => {
  const headings = readFileSync(filePath, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm);

  return new Set([...headings].map((match) => slugify(match[1])));
};

interface Link {
  page: string;
  target: string;
  filePath: string;
  anchor: string | undefined;
}

const linksOf = (page: string): Link[] => {
  const pagePath = join(ROOT_DIR, page);
  const body = readFileSync(pagePath, 'utf8');

  return [...body.matchAll(MARKDOWN_LINK)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith('http') && !target.startsWith('#'))
    .map((target) => {
      const [filePart, anchor] = target.split('#');

      return {
        page,
        target,
        filePath: resolve(dirname(pagePath), filePart),
        anchor,
      };
    });
};

const allLinks = PAGES.flatMap(linksOf);

describe('the route links', () => {
  it('points at pages that exist', () => {
    const broken = allLinks.filter(({ filePath }) => !existsSync(filePath));

    expect(broken).toEqual([]);
  });

  it('points at anchors that exist', () => {
    const broken = allLinks.filter(
      ({ filePath, anchor }) =>
        anchor !== undefined &&
        existsSync(filePath) &&
        !anchorsOf(filePath).has(anchor)
    );

    expect(broken).toEqual([]);
  });

  it('is reachable from the files an author already opens', () => {
    const agents = readFileSync(join(ROOT_DIR, 'AGENTS.md'), 'utf8');
    const contributing = readFileSync(
      join(ROOT_DIR, 'CONTRIBUTING.md'),
      'utf8'
    );

    expect(agents).toContain('docs/widget-authoring.md');
    expect(contributing).toContain('docs/widget-authoring.md');
    expect(contributing).toContain('docs/README.md');
  });
});

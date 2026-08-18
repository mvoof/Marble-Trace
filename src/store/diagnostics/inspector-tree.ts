import type { InspectorRow, InspectorValueKind } from '@/types/inspector';

/**
 * Turns a telemetry frame or a session snapshot into the flat list of rows the
 * inspector draws.
 *
 * Flat rather than nested because the panel is a scrolling list and the filter
 * has to be able to reach a leaf without its parents being open. `depth` carries
 * the indentation the nesting would otherwise express.
 *
 * The walk is **lazy**: it descends into a node only when that node is expanded,
 * or when a filter is active. A session snapshot holds a full grid of drivers —
 * expanding it eagerly would build thousands of rows four times a second to draw
 * a dozen.
 */

/** Children built for one array row before the rest are left to a "show more". */
export const ARRAY_PAGE = 64;

const kindOf = (value: unknown): InspectorValueKind => {
  if (value === null || value === undefined) {
    return 'absent';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  const type = typeof value;

  if (type === 'number' || type === 'boolean' || type === 'string') {
    return type;
  }

  return 'object';
};

/** A node the walk can go inside — anything else is a leaf. */
const isBranch = (kind: InspectorValueKind): boolean =>
  kind === 'array' || kind === 'object';

const childrenOf = (
  value: unknown,
  kind: InspectorValueKind,
  limit: number
): [string, unknown][] => {
  if (kind === 'array') {
    return (value as unknown[])
      .slice(0, limit)
      .map((item, index) => [String(index), item]);
  }

  return Object.entries(value as Record<string, unknown>);
};

export interface BuildOptions {
  /** Paths the user opened. */
  expanded: ReadonlySet<string>;
  /** Lower-cased substring; empty means no filtering. */
  filter: string;
  /** Drop rows the sim is not reporting. */
  hideAbsent: boolean;
  /** Per-array cap, raised by "show all" on that row. */
  arrayLimits: ReadonlyMap<string, number>;
}

/**
 * A filter matches a row when its own path matches, or when anything below it
 * does — otherwise searching for `lap_dist` would find nothing, because the
 * match is on a leaf whose parent the user never opened.
 */
const subtreeMatches = (
  name: string,
  value: unknown,
  needle: string
): boolean => {
  if (name.toLowerCase().includes(needle)) {
    return true;
  }

  const kind = kindOf(value);

  if (kind === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([childName, child]) => subtreeMatches(childName, child, needle)
    );
  }

  // An array's entries are numbered, so their names can never match a word.
  // Matching one entry of it is not something anyone searches for.
  return false;
};

export const buildRows = (
  source: Record<string, unknown> | null,
  options: BuildOptions
): InspectorRow[] => {
  if (!source) {
    return [];
  }

  const rows: InspectorRow[] = [];

  const walk = (
    entries: [string, unknown][],
    parentPath: string,
    depth: number
  ) => {
    for (const [name, value] of entries) {
      const path = parentPath === '' ? name : `${parentPath}.${name}`;
      const kind = kindOf(value);

      if (options.hideAbsent && kind === 'absent') {
        continue;
      }

      if (
        options.filter !== '' &&
        !subtreeMatches(name, value, options.filter)
      ) {
        continue;
      }

      const branch = isBranch(kind);
      const length = kind === 'array' ? (value as unknown[]).length : undefined;
      const expanded = branch && options.expanded.has(path);

      rows.push({
        path,
        name,
        depth,
        kind,
        value,
        length,
        expandable: branch && length !== 0,
        expanded,
      });

      if (!expanded) {
        continue;
      }

      const limit = options.arrayLimits.get(path) ?? ARRAY_PAGE;

      // The filter applies to what the user is looking for, not to the entries
      // of an array they deliberately opened.
      walk(childrenOf(value, kind, limit), path, depth + 1);
    }
  };

  walk(Object.entries(source), '', 0);

  return rows;
};

/** Every leaf under `source`, used only for the "absent" tally in the header. */
export const countAbsent = (source: Record<string, unknown> | null): number => {
  if (!source) {
    return 0;
  }

  let absent = 0;

  const visit = (value: unknown) => {
    const kind = kindOf(value);

    if (kind === 'absent') {
      absent += 1;

      return;
    }

    // Array entries are data, not fields — an empty slot in a per-car array
    // means "no car there", which is not a field the sim failed to report.
    if (kind === 'object') {
      for (const child of Object.values(value as Record<string, unknown>)) {
        visit(child);
      }
    }
  };

  for (const value of Object.values(source)) {
    visit(value);
  }

  return absent;
};

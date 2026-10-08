// The layer and slice boundaries of src/ (docs/adr, AGENTS.md → Layers), as an
// oxlint JS plugin: `no-restricted-imports` cannot say "any slice but your
// own", and oxlint keeps only the last override that sets a rule, so one rule
// per concern is the only way the two checks do not overwrite each other.
//
//   app → pages → widgets → features → entities → shared
//
// - nothing imports a layer above its own;
// - a slice of entities/, features/, widgets/ or pages/ does not import a
//   sibling slice of its layer, except the edges named in `allowedSiblings`
//   (checked to stay acyclic);
// - shared/contracts imports nothing but itself.
//
// A file directly in a layer folder (`widgets/registry.ts`) belongs to no slice
// and is shared by the layer. `import.meta.glob` is not an import and is not
// checked: the catalogue and the registries read slices above them that way.
import path from 'node:path';

const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app'];
const SLICED_LAYERS = new Set(['entities', 'features', 'widgets', 'pages']);
const CONTRACTS_SEGMENT = 'contracts';

const ALIASES = [
  ['@app/', 'app/'],
  ['@pages/', 'pages/'],
  ['@widgets/', 'widgets/'],
  ['@features/', 'features/'],
  ['@entities/', 'entities/'],
  ['@shared/', 'shared/'],
  ['@/', ''],
];

const SRC_MARKER = '/src/';

const toPosix = (filePath) => filePath.split(path.sep).join('/');

/** The path below src/, or null for a file outside it. */
const srcRelative = (absolutePath) => {
  const posixPath = toPosix(absolutePath);
  const markerIndex = posixPath.lastIndexOf(SRC_MARKER);

  if (markerIndex === -1) {
    return null;
  }

  return posixPath.slice(markerIndex + SRC_MARKER.length);
};

/** Layer, its rank and slice (segment for shared/app) of a src-relative path. */
const locate = (relativePath) => {
  const segments = relativePath.split('/');
  const rank = LAYERS.indexOf(segments[0]);

  if (rank === -1) {
    return null;
  }

  const isInsideFolder = segments.length > 2;

  return {
    layer: segments[0],
    rank,
    slice: isInsideFolder ? segments[1] : null,
  };
};

const resolveSpecifier = (specifier, importerRelative) => {
  for (const [alias, target] of ALIASES) {
    if (specifier.startsWith(alias)) {
      return target + specifier.slice(alias.length);
    }
  }

  if (specifier.startsWith('.')) {
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(importerRelative), specifier)
    );
  }

  return null;
};

const findCycle = (allowedSiblings) => {
  const visiting = new Set();
  const done = new Set();

  const visit = (node, trail) => {
    if (done.has(node)) {
      return null;
    }

    if (visiting.has(node)) {
      return [...trail.slice(trail.indexOf(node)), node];
    }

    visiting.add(node);

    const [layer] = node.split('/');

    for (const sibling of allowedSiblings[node] ?? []) {
      const cycle = visit(`${layer}/${sibling}`, [...trail, node]);

      if (cycle) {
        return cycle;
      }
    }

    visiting.delete(node);
    done.add(node);

    return null;
  };

  for (const node of Object.keys(allowedSiblings)) {
    const cycle = visit(node, []);

    if (cycle) {
      return cycle;
    }
  }

  return null;
};

const checkedGraphs = new WeakSet();

const assertAcyclic = (allowedSiblings) => {
  if (checkedGraphs.has(allowedSiblings)) {
    return;
  }

  const cycle = findCycle(allowedSiblings);

  if (cycle) {
    throw new Error(
      `layers/boundaries: allowedSiblings has a cycle: ${cycle.join(' → ')}`
    );
  }

  checkedGraphs.add(allowedSiblings);
};

const violationOf = (importer, target, allowedSiblings) => {
  if (target.rank > importer.rank) {
    return `${importer.layer}/ may not import ${target.layer}/: layers import downward only (app → pages → widgets → features → entities → shared).`;
  }

  const isContracts =
    importer.layer === 'shared' && importer.slice === CONTRACTS_SEGMENT;

  if (
    isContracts &&
    !(target.layer === 'shared' && target.slice === CONTRACTS_SEGMENT)
  ) {
    return 'shared/contracts/ is the contract every layer reads and imports nothing but itself.';
  }

  const isSiblingSlice =
    target.layer === importer.layer &&
    SLICED_LAYERS.has(importer.layer) &&
    importer.slice !== null &&
    target.slice !== null &&
    target.slice !== importer.slice;

  if (!isSiblingSlice) {
    return null;
  }

  const allowed = allowedSiblings[`${importer.layer}/${importer.slice}`] ?? [];

  if (allowed.includes(target.slice)) {
    return null;
  }

  return `${importer.layer}/${importer.slice} may not import its sibling slice ${target.layer}/${target.slice}. Move what both need down a layer, lift the pair into a slice above, or take a narrow interface; a deliberate entity edge is named in allowedSiblings (.oxlintrc.json).`;
};

const boundaries = {
  meta: {
    type: 'problem',
    schema: [
      {
        type: 'object',
        properties: {
          allowedSiblings: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create: (context) => {
    const allowedSiblings = context.options[0]?.allowedSiblings ?? {};

    assertAcyclic(allowedSiblings);

    const importerRelative = srcRelative(context.filename);
    const importer = importerRelative ? locate(importerRelative) : null;

    if (!importer) {
      return {};
    }

    const checkSource = (sourceNode) => {
      if (!sourceNode || typeof sourceNode.value !== 'string') {
        return;
      }

      const targetRelative = resolveSpecifier(
        sourceNode.value,
        importerRelative
      );
      const target = targetRelative ? locate(targetRelative) : null;

      if (!target) {
        return;
      }

      const message = violationOf(importer, target, allowedSiblings);

      if (message) {
        context.report({ node: sourceNode, message });
      }
    };

    return {
      ImportDeclaration: (node) => checkSource(node.source),
      ExportNamedDeclaration: (node) => checkSource(node.source),
      ExportAllDeclaration: (node) => checkSource(node.source),
      ImportExpression: (node) => checkSource(node.source),
    };
  },
};

export default {
  meta: { name: 'layers' },
  rules: { boundaries },
};

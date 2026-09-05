import { describe, expect, it } from 'vitest';

import { WIDGETS } from '@store/widget-catalog';
import {
  hotFieldsOf,
  HOT_TELEMETRY_FIELDS,
  HOT_WIDGET_IDS,
} from './hot-fields';

/**
 * Coverage, derived rather than listed: the population under budget is the set
 * of widgets whose own manifest declares a hot field, so a widget that starts
 * reading one falls under the check without anyone remembering to add it here.
 *
 * A widget in that set with no `*.perf.test.tsx` in its folder is the failure
 * this test exists for.
 */

/** Every perf test in the repo, by the widget folder it sits under. */
const perfTestModules = import.meta.glob('../ui/widgets/*/**/*.perf.test.tsx');

const WIDGET_FOLDER = /^\.\.\/ui\/widgets\/([^/]+)\//;

const foldersWithPerfTest = new Set(
  Object.keys(perfTestModules)
    .map((path) => WIDGET_FOLDER.exec(path)?.[1])
    .filter((folder): folder is string => folder !== undefined)
);

/** Every widget's folder, from the manifest that sits in it. */
const manifestModules = import.meta.glob('../ui/widgets/*/manifest.ts', {
  eager: true,
});

const folderByWidgetId = new Map(
  Object.entries(manifestModules).map(([path, module]) => {
    const manifest = Object.values(
      module as Record<string, { id?: string }>
    ).find((exported) => exported?.id !== undefined)!;

    return [manifest.id!, WIDGET_FOLDER.exec(path)![1]];
  })
);

describe('render budget coverage', () => {
  it('gives every widget that declares a hot field a perf test', () => {
    const uncovered = HOT_WIDGET_IDS.filter(
      (widgetId) => !foldersWithPerfTest.has(folderByWidgetId.get(widgetId)!)
    );

    expect(uncovered).toEqual([]);
  });

  it('declares no hot field the burst cannot advance', () => {
    // Every field a manifest declares has to be one `telemetry-bursts.ts` knows
    // how to move; a field it does not know would be measured against a burst
    // that never touches it, and would pass at zero for the wrong reason.
    const declared = new Set(
      WIDGETS.flatMap((manifest) => hotFieldsOf(manifest))
    );

    const unknown = [...declared].filter(
      (field) => !HOT_TELEMETRY_FIELDS.includes(field)
    );

    expect(unknown).toEqual([]);
  });
});

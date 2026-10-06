import type {
  WidgetManifest,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

/**
 * Every widget the app ships, collected from the per-widget manifests.
 *
 * The manifests live next to the widgets they describe, which is where they are
 * edited, and they are collected here rather than listed — a new widget is a
 * new folder, and no shared file has to be touched for it to ship.
 *
 * They carry no React: a manifest is plain data, the id -> component map is
 * `ui/widgets/registry.ts`, and nothing here imports it. That is what lets the
 * store layer read a file under `ui/` without pulling the UI in behind it.
 *
 * Every list the user sees is alphabetical by label — the Widgets page, each
 * monitor's list in the layout editor, the F9 picker — so the catalog is kept
 * in that order and nothing declares a position of its own. A new widget lands
 * where its name puts it.
 */
const manifestModules = import.meta.glob<Record<string, WidgetManifest>>(
  '../../ui/widgets/*/manifest.ts',
  { eager: true }
);

const manifestOf = (module: Record<string, WidgetManifest>): WidgetManifest =>
  Object.values(module).find((exported) => exported?.id !== undefined)!;

// Code-unit comparison, not localeCompare: the order must come out the same on
// every machine, and collation depends on the runtime's locale data. Labels are
// English everywhere, so lower-casing is all the folding they need.
const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Catalog order: alphabetical by label, then the id so a tie is deterministic. */
export const compareManifests = (
  left: WidgetManifest,
  right: WidgetManifest
): number =>
  compareText(left.label.toLowerCase(), right.label.toLowerCase()) ||
  compareText(left.id, right.id);

export const WIDGETS: WidgetManifest[] = Object.values(manifestModules)
  .map(manifestOf)
  .sort(compareManifests);

export const WIDGET_BY_ID = new Map(
  WIDGETS.map((manifest) => [manifest.id, manifest])
);

// Keys the saved copy must not carry. `resolveLayoutChange` is a function and
// could not survive the round trip through settings.json anyway;
// `telemetryEvents` could, and that is exactly the problem — it is what this
// build's widget reads, not a user choice, and a stale copy on disk would
// outlive the widget that declared it.
const NON_SERIALIZABLE_WIDGET_KEYS = new Set([
  'resolveLayoutChange',
  'deriveDesignWidth',
  'telemetryEvents',
  'previewScenarios',
  'previewBaseline',
]);

export const DEFAULT_WIDGETS: WidgetDefaultConfig[] = WIDGETS.map(
  (manifest) => {
    const allowedEntries = Object.entries(manifest).filter(([key]) => {
      return !NON_SERIALIZABLE_WIDGET_KEYS.has(key);
    });

    return {
      ...Object.fromEntries(allowedEntries),
      type: manifest.id,
    } as WidgetDefaultConfig;
  }
);

// The same records addressed by id. `getSettings` resolves a widget's shipped
// defaults on every render of every widget — a linear scan there was measured
// at 2688 calls a second while racing.
export const DEFAULT_WIDGET_BY_ID = new Map(
  DEFAULT_WIDGETS.map((defaultWidget) => [defaultWidget.id, defaultWidget])
);

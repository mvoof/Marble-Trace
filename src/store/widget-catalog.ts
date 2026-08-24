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
 * `order` decides the position in the catalog list; ties fall back to the id,
 * so two widgets built in parallel that pick the same number still land in a
 * stable order instead of conflicting.
 */
const manifestModules = import.meta.glob<Record<string, WidgetManifest>>(
  '../ui/widgets/*/manifest.ts',
  { eager: true }
);

const manifestOf = (module: Record<string, WidgetManifest>): WidgetManifest =>
  Object.values(module).find((exported) => exported?.id !== undefined)!;

const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;

export const WIDGETS: WidgetManifest[] = Object.values(manifestModules)
  .map(manifestOf)
  .sort((left, right) => {
    const byOrder =
      (left.order ?? DEFAULT_ORDER) - (right.order ?? DEFAULT_ORDER);

    return byOrder !== 0 ? byOrder : left.id.localeCompare(right.id);
  });

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
  'telemetryEvents',
  'order',
]);

export const DEFAULT_WIDGETS: WidgetDefaultConfig[] = WIDGETS.map(
  (manifest) => {
    const allowedEntries = Object.entries(manifest).filter(([key]) => {
      return !NON_SERIALIZABLE_WIDGET_KEYS.has(key);
    });

    return Object.fromEntries(allowedEntries) as WidgetDefaultConfig;
  }
);

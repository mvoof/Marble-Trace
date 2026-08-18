import type { SettingsBlob } from './types';

/**
 * Structural helpers for walking a raw `settings.json` blob.
 *
 * These exist for one reason: **a widget appears in the file twice.** Once in
 * the top-level `widgets[]`, and once more inside every entry of
 * `layouts[].widgets[]`. `mergeWithDefaults` runs after the chain and repairs
 * only the first copy — it never descends into layouts — so a migration that
 * touches the top-level array and stops there leaves every layout carrying the
 * old shape. That failure is quiet: the app starts, the widget looks right until
 * the user switches layout, and the bad copy outlives the build that wrote it.
 *
 * Using {@link mapEveryWidget} makes forgetting structurally impossible, which
 * is the whole point of putting it here rather than in a paragraph of the docs.
 *
 * These helpers know nothing about any widget id, setting name or default. That
 * is deliberate and must stay that way — a migration may use them freely without
 * breaking the rule that it must never import live types, defaults or
 * registries.
 */

/** A widget as it appears on disk. Nothing about it is guaranteed. */
export interface BlobWidget {
  id?: string;
  userSettings?: Record<string, unknown>;
  [key: string]: unknown;
}

export const asObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const asArray = <T>(value: unknown): T[] =>
  Array.isArray(value) ? value : [];

/**
 * Applies `transform` to the top-level `widgets[]` and to the `widgets[]` of
 * every layout, returning a new blob. Anything else in the file is passed
 * through untouched, including layouts that are not objects — those are left
 * exactly as found rather than repaired, because a migration is not the place to
 * decide what a corrupt layout should have been.
 */
export const mapEveryWidget = (
  blob: SettingsBlob,
  transform: (widgets: BlobWidget[]) => BlobWidget[]
): SettingsBlob => ({
  ...blob,
  widgets: transform(asArray<BlobWidget>(blob['widgets'])),
  layouts: asArray<unknown>(blob['layouts']).map((layout) => {
    const entry = asObject(layout);

    if (!entry) {
      return layout;
    }

    return {
      ...entry,
      widgets: transform(asArray<BlobWidget>(entry['widgets'])),
    };
  }),
});

/**
 * Rewrites the `userSettings` of every copy of one widget. `patch` receives the
 * settings object and returns its replacement; returning the same object is
 * fine, it is cloned before it reaches you.
 *
 * A widget the file does not contain is simply not visited — a migration must
 * never add a widget that was not there, because the widget map is filled from
 * the shipped defaults afterwards and an invented entry would outrank them.
 */
export const patchWidgetSettings = (
  blob: SettingsBlob,
  widgetId: string,
  patch: (settings: Record<string, unknown>) => Record<string, unknown>
): SettingsBlob =>
  mapEveryWidget(blob, (widgets) =>
    widgets.map((widget) => {
      if (widget?.id !== widgetId) {
        return widget;
      }

      return {
        ...widget,
        userSettings: patch({ ...(asObject(widget.userSettings) ?? {}) }),
      };
    })
  );

/**
 * Moves one setting to a new key in every copy of a widget. A widget whose file
 * has no value under `from` is left alone rather than given `undefined` under
 * `to`, so the shipped default survives the merge that follows.
 */
export const renameWidgetSetting = (
  blob: SettingsBlob,
  widgetId: string,
  from: string,
  to: string
): SettingsBlob =>
  patchWidgetSettings(blob, widgetId, (settings) => {
    if (!(from in settings)) {
      return settings;
    }

    const { [from]: moved, ...rest } = settings;

    return { ...rest, [to]: moved };
  });

/** Deletes settings from every copy of a widget. */
export const dropWidgetSettings = (
  blob: SettingsBlob,
  widgetId: string,
  keys: readonly string[]
): SettingsBlob =>
  patchWidgetSettings(blob, widgetId, (settings) => {
    for (const key of keys) {
      delete settings[key];
    }

    return settings;
  });

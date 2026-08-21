import type { SettingsBlob } from './types';

/**
 * Structural helpers for walking a raw `settings.json` blob.
 *
 * These exist for one reason: **a widget appears in the file twice.** Once in
 * the top-level `widgets[]`, and once more inside every entry of
 * `layouts[].widgets[]`. Defaulting reaches both copies (`restoreLayoutWidgets`
 * in `sync/persistence.ts`), but it only fills in what is missing — a value the
 * file already holds is left exactly as found. So a migration that rewrites
 * values and touches the top-level array only leaves every layout carrying the
 * old one. That failure is quiet: the app starts, the widget looks right until
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
): SettingsBlob => {
  const mapped: SettingsBlob = { ...blob };

  // A key the file does not have stays absent. Writing an empty array here
  // would turn "this file predates layouts" into "this user deleted every
  // layout", and the defaulting that runs afterwards tells those apart.
  if ('widgets' in blob) {
    mapped['widgets'] = transform(asArray<BlobWidget>(blob['widgets']));
  }

  if ('layouts' in blob) {
    mapped['layouts'] = asArray<unknown>(blob['layouts']).map((layout) => {
      const entry = asObject(layout);

      if (!entry) {
        return layout;
      }

      if (!('widgets' in entry)) {
        return entry;
      }

      return {
        ...entry,
        widgets: transform(asArray<BlobWidget>(entry['widgets'])),
      };
    });
  }

  return mapped;
};

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

/**
 * Deletes every copy of the given widget ids. Used when a widget is removed from
 * the build: the entry survives in both arrays otherwise, and the layout mounts
 * an id the component registry no longer answers.
 */
export const removeWidgets = (
  blob: SettingsBlob,
  ids: readonly string[]
): SettingsBlob =>
  mapEveryWidget(blob, (widgets) =>
    widgets.filter((widget) => !ids.includes(String(widget?.id)))
  );

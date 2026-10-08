import type { SettingsBlob } from './types';

/**
 * Structural helpers for walking a raw `settings.json` blob.
 *
 * These exist for one reason: **a widget appears in the file many times.** Once
 * inside every entry of `layouts[].widgets[]` — each layout carries the full
 * catalogue, enabled or not — once in `defaultWidgets[]`, the template list a
 * new layout is built from, and, in a file written before v3, once more in the
 * long-gone top-level `widgets[]`. Defaulting reaches all of them
 * (`restoreLayoutWidgets` in `sync/persistence.ts`), but it only fills in what
 * is missing — a value the file already holds is left exactly as found. So a
 * migration that rewrites values and visits one array leaves every other copy
 * carrying the old one. That failure is quiet: the app starts, the widget looks
 * right until the user switches layout, and the bad copy outlives the build
 * that wrote it.
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
 * Applies `transform` to every widget array in the file — `defaultWidgets[]`,
 * the `widgets[]` of every layout, and the pre-v3 top-level `widgets[]` — and
 * returns a new blob. Anything else is passed through untouched, including
 * layouts that are not objects: those are left exactly as found rather than
 * repaired, because a migration is not the place to decide what a corrupt
 * layout should have been.
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

  if ('defaultWidgets' in blob) {
    mapped['defaultWidgets'] = transform(
      asArray<BlobWidget>(blob['defaultWidgets'])
    );
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

// ── From v6: widgets stored under their monitor ─────────────────────────────
//
// v6 moved every widget into `layouts[].monitors[].widgets[]` and turned
// `defaultWidgets[]` into `widgetTemplates`, keyed by type. The helpers above
// walk the older shape and find nothing in a v6 file — they stay for the steps
// written before it. A step after v6 uses these.
//
// Two things differ from the older shape and change what a patch sees:
//
// - an instance is addressed by its **type** (`widget.type`), a template by its
//   key — there is no "original" whose id doubles as a type any more;
// - `settings` holds **only the values that differ from the manifest**. A key
//   that is absent is on the shipped default, so a step rewriting a value
//   leaves an absent key absent: the default it means is whatever the build
//   ships, which is the step's to decide only if it writes one explicitly.

/** A widget instance as it appears in a v6 file. Nothing about it is guaranteed. */
export interface StoredBlobWidget {
  id?: string;
  type?: string;
  settings?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Applies `transform` to every widget array of a v6 file — the `widgets[]` of
 * every monitor of every layout — and returns a new blob. Layouts and monitors
 * that are not objects are passed through untouched.
 */
export const mapEveryStoredWidget = (
  blob: SettingsBlob,
  transform: (widgets: StoredBlobWidget[]) => StoredBlobWidget[]
): SettingsBlob => {
  if (!('layouts' in blob)) {
    return { ...blob };
  }

  return {
    ...blob,
    layouts: asArray<unknown>(blob['layouts']).map((layout) => {
      const entry = asObject(layout);

      if (!entry || !('monitors' in entry)) {
        return layout;
      }

      return {
        ...entry,
        monitors: asArray<unknown>(entry['monitors']).map((monitor) => {
          const screen = asObject(monitor);

          if (!screen || !('widgets' in screen)) {
            return monitor;
          }

          return {
            ...screen,
            widgets: transform(asArray<StoredBlobWidget>(screen['widgets'])),
          };
        }),
      };
    }),
  };
};

/**
 * Rewrites the `settings` of every instance of one widget type and of its
 * template. `patch` receives a copy of the overrides — see the note above on
 * what an absent key means.
 */
export const patchStoredWidgetSettings = (
  blob: SettingsBlob,
  type: string,
  patch: (settings: Record<string, unknown>) => Record<string, unknown>
): SettingsBlob => {
  const mapped = mapEveryStoredWidget(blob, (widgets) =>
    widgets.map((widget) =>
      widget?.type === type
        ? {
            ...widget,
            settings: patch({ ...(asObject(widget.settings) ?? {}) }),
          }
        : widget
    )
  );

  const templates = asObject(blob['widgetTemplates']);
  const template = asObject(templates?.[type]);

  if (!templates || !template) {
    return mapped;
  }

  return {
    ...mapped,
    widgetTemplates: {
      ...templates,
      [type]: {
        ...template,
        settings: patch({ ...(asObject(template['settings']) ?? {}) }),
      },
    },
  };
};

/** Moves one setting to a new key in every instance and the template of a type. */
export const renameStoredWidgetSetting = (
  blob: SettingsBlob,
  type: string,
  from: string,
  to: string
): SettingsBlob =>
  patchStoredWidgetSettings(blob, type, (settings) => {
    if (!(from in settings)) {
      return settings;
    }

    const { [from]: moved, ...rest } = settings;

    return { ...rest, [to]: moved };
  });

/** Deletes settings from every instance and the template of a type. */
export const dropStoredWidgetSettings = (
  blob: SettingsBlob,
  type: string,
  keys: readonly string[]
): SettingsBlob =>
  patchStoredWidgetSettings(blob, type, (settings) => {
    for (const key of keys) {
      delete settings[key];
    }

    return settings;
  });

/**
 * Deletes every instance and the template of the given types — for a widget
 * removed from the build.
 */
export const removeStoredWidgets = (
  blob: SettingsBlob,
  types: readonly string[]
): SettingsBlob => {
  const mapped = mapEveryStoredWidget(blob, (widgets) =>
    widgets.filter((widget) => !types.includes(String(widget?.type)))
  );

  const templates = asObject(blob['widgetTemplates']);

  if (!templates) {
    return mapped;
  }

  return {
    ...mapped,
    widgetTemplates: Object.fromEntries(
      Object.entries(templates).filter(([type]) => !types.includes(type))
    ),
  };
};

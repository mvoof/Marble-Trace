import type { Migration, SettingsBlob } from '../types';
import { asArray, asObject, type BlobWidget } from '../blob';

/**
 * v5 → v6. Widgets move under the monitor they stand on.
 *
 * Until v5 a layout held one flat `widgets[]` in desktop-wide coordinates, and
 * the monitor a widget belonged to was whichever one contained its centre.
 * From v6 each monitor owns its own set: `layouts[].monitors[].widgets[]`, in
 * that monitor's own coordinates, and a widget changes monitor only when it is
 * moved there explicitly.
 *
 * Each record also sheds what was never the user's:
 *
 * - geometry leaves `userSettings` for `frame` (`x`, `y`, `width`, `height`,
 *   `z`) and `enabled` sits beside it;
 * - the manifest's own fields (label, description, flags) are dropped — the
 *   build supplies them;
 * - the design size moves to `design`. It is carried over as found; the next
 *   save drops it wherever it is the one the manifest gives anyway.
 *
 * Settings are carried over **whole**. From v6 the file holds only the values
 * that differ from the manifest, but deciding which ones do would mean reading
 * this build's defaults — which a migration must never do. A value equal to
 * the default reads back the same either way, and the first save thins it.
 *
 * `defaultWidgets[]` — the Widgets page's catalogue — becomes
 * `widgetTemplates`, keyed by widget type, with a size and no position.
 *
 * Every rule below is frozen: the centre-point ownership test is v5's, written
 * out here rather than imported.
 */

const GEOMETRY_KEYS = [
  'enabled',
  'x',
  'y',
  'currentWidth',
  'currentHeight',
  'zIndex',
] as const;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const asRect = (value: unknown): Rect | undefined => {
  const rect = asObject(value);

  if (
    !rect ||
    !isFiniteNumber(rect['x']) ||
    !isFiniteNumber(rect['y']) ||
    !isFiniteNumber(rect['width']) ||
    !isFiniteNumber(rect['height'])
  ) {
    return undefined;
  }

  return {
    x: rect['x'],
    y: rect['y'],
    width: rect['width'],
    height: rect['height'],
  };
};

/** What a v5 record's type was: `type` on a copy, the id on the original. */
const typeOf = (widget: BlobWidget): string => {
  const type = widget['type'];

  return typeof type === 'string' ? type : String(widget.id);
};

const settingsWithoutGeometry = (
  settings: Record<string, unknown>
): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...settings };

  for (const key of GEOMETRY_KEYS) {
    delete rest[key];
  }

  return rest;
};

const designOf = (widget: BlobWidget) =>
  isFiniteNumber(widget['designWidth']) &&
  isFiniteNumber(widget['designHeight'])
    ? {
        design: {
          width: widget['designWidth'],
          height: widget['designHeight'],
        },
      }
    : {};

/** A number the file holds, written only when it is one. */
const numberEntry = (key: string, value: unknown) =>
  isFiniteNumber(value) ? { [key]: value } : {};

const toStoredWidget = (widget: BlobWidget, origin: Rect) => {
  const settings = asObject(widget.userSettings) ?? {};
  const x = settings['x'];
  const y = settings['y'];

  return {
    id: String(widget.id),
    type: typeOf(widget),
    enabled: settings['enabled'] === true,
    frame: {
      ...(isFiniteNumber(x) ? { x: x - origin.x } : {}),
      ...(isFiniteNumber(y) ? { y: y - origin.y } : {}),
      ...numberEntry('width', settings['currentWidth']),
      ...numberEntry('height', settings['currentHeight']),
      ...numberEntry('z', settings['zIndex']),
    },
    ...designOf(widget),
    settings: settingsWithoutGeometry(settings),
  };
};

/**
 * v5's ownership rule: the monitor containing the widget's centre, else the
 * first monitor. A widget with no usable position goes to the first monitor.
 */
const ownerIndexOf = (widget: BlobWidget, rects: Rect[]): number => {
  const settings = asObject(widget.userSettings) ?? {};
  const { x, y, currentWidth: width, currentHeight: height } = settings;

  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height)
  ) {
    return 0;
  }

  const centreX = x + width / 2;
  const centreY = y + height / 2;
  const index = rects.findIndex(
    (rect) =>
      centreX >= rect.x &&
      centreX < rect.x + rect.width &&
      centreY >= rect.y &&
      centreY < rect.y + rect.height
  );

  return index === -1 ? 0 : index;
};

const migrateLayout = (layout: unknown): unknown => {
  const entry = asObject(layout);

  // A layout that is not an object is left exactly as found: a migration is
  // not the place to decide what a corrupt layout should have been.
  if (!entry) {
    return layout;
  }

  const {
    widgets: rawWidgets,
    backgroundImages: rawImages,
    monitors: rawMonitors,
    ...rest
  } = entry;

  const images = asObject(rawImages) ?? {};
  const monitors = asArray<unknown>(rawMonitors)
    .map(asObject)
    .filter((monitor): monitor is Record<string, unknown> => !!monitor);

  // Already in the v6 shape — the step's own output. Running it again must
  // change nothing, and above all must not empty the monitors it filled.
  if (
    rawWidgets === undefined &&
    rawImages === undefined &&
    monitors.every((monitor) => Array.isArray(monitor['widgets']))
  ) {
    return entry;
  }
  const rects = monitors.map(
    (monitor) =>
      asRect(monitor['bounds']) ?? { x: 0, y: 0, width: 0, height: 0 }
  );

  const owned: unknown[][] = monitors.map(() => []);

  // A layout with no monitor has nowhere to put a widget, and the app never
  // drew the ones it held: it seeds such a layout afresh once a monitor is
  // anchored. Nothing is lost by leaving them behind.
  if (monitors.length > 0) {
    for (const widget of asArray<BlobWidget>(rawWidgets)) {
      if (!asObject(widget) || widget.id === undefined) continue;

      const index = ownerIndexOf(widget, rects);

      owned[index].push(toStoredWidget(widget, rects[index]));
    }
  }

  return {
    ...rest,
    monitors: monitors.map((monitor, index) => {
      const image = images[String(monitor['name'])];

      return {
        ...monitor,
        ...(typeof image === 'string' && image
          ? { backgroundImage: image }
          : {}),
        widgets: owned[index],
      };
    }),
  };
};

const toTemplates = (defaultWidgets: unknown): Record<string, unknown> => {
  const templates: Record<string, unknown> = {};

  for (const widget of asArray<BlobWidget>(defaultWidgets)) {
    if (!asObject(widget) || widget.id === undefined) continue;

    const type = typeOf(widget);

    if (type in templates) continue;

    const settings = asObject(widget.userSettings) ?? {};

    templates[type] = {
      enabled: settings['enabled'] === true,
      size: {
        ...numberEntry('width', settings['currentWidth']),
        ...numberEntry('height', settings['currentHeight']),
      },
      ...designOf(widget),
      settings: settingsWithoutGeometry(settings),
    };
  }

  return templates;
};

export const v6PerMonitorWidgets: Migration = {
  to: 6,
  describe: 'widgets stored under the monitor they belong to',
  migrate: (blob: SettingsBlob): SettingsBlob => {
    const { defaultWidgets, ...migrated }: SettingsBlob = { ...blob };

    // A key the file does not have stays absent, the same as `mapEveryWidget`:
    // "this file predates layouts" is not "this user deleted every layout".
    if ('layouts' in blob) {
      migrated['layouts'] = asArray<unknown>(blob['layouts']).map(
        migrateLayout
      );
    }

    if (defaultWidgets !== undefined) {
      migrated['widgetTemplates'] = toTemplates(defaultWidgets);
    }

    return migrated;
  },
};

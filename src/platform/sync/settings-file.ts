import { isPlainObject, mergeWithDefaults } from '@store/deep-merge';
import { DEFAULT_WIDGET_BY_ID, WIDGET_BY_ID } from '@store/widget-catalog';
import { primaryMonitorOf } from '@store/settings/virtual-desktop';
import { cloneMonitor } from '@utils/remote-screen';
import type {
  LayoutMonitor,
  MonitorBounds,
  SavedLayout,
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@/types/widget-settings';

/**
 * How widgets and layouts are written to `settings.json`, and read back.
 *
 * The app works on widget records that carry everything at once — the
 * manifest's metadata, desktop-wide coordinates, every setting resolved. The
 * file holds only what is the user's:
 *
 * - a widget stands **inside its monitor**, in that monitor's own coordinates,
 *   so moving a monitor rewrites one rectangle and not every widget on it;
 * - its geometry (`frame`) is kept apart from its settings;
 * - a setting is written only when it differs from the manifest — a new
 *   default reaches every widget that never changed it, and a new setting
 *   needs no migration;
 * - nothing the manifest already says is written: label, description, flags.
 *   A design size is written only when it is not the one the manifest (or the
 *   widget's own settings) would give, which is the case only for a widget
 *   whose orientation switch sets one.
 *
 * Everything here is the codec between the two and nothing else: no store is
 * touched. A shape change to the file still goes through the schema chain in
 * `platform/settings-schema/` — this module only ever reads the current one.
 */

/** A widget's place on its monitor, in that monitor's own coordinates. */
export interface StoredFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
}

export interface StoredDesignSize {
  width: number;
  height: number;
}

export interface StoredWidget {
  id: string;
  type: string;
  enabled: boolean;
  frame: StoredFrame;
  /** Absent unless the widget is drawn at a design size the manifest does not give. */
  design?: StoredDesignSize;
  /** The settings that differ from the manifest's, and only those. */
  settings: Record<string, unknown>;
}

export interface StoredMonitor extends LayoutMonitor {
  /** Background image drawn behind this monitor's widgets in the editor. */
  backgroundImage?: string;
  widgets: StoredWidget[];
}

export interface StoredLayout {
  id: string;
  name: string;
  createdAt: number;
  primaryMonitor?: string;
  monitors: StoredMonitor[];
}

/**
 * A widget as the Widgets page edits it, before it stands on any monitor: what
 * a new instance starts from. It has a size and settings, but no place.
 */
export interface StoredTemplate {
  /** Part of the starter set a new layout opens with. */
  enabled: boolean;
  size: { width: number; height: number };
  design?: StoredDesignSize;
  settings: Record<string, unknown>;
}

// The keys of `userSettings` that are geometry rather than settings. On disk
// they live in `frame` and `enabled`.
const GEOMETRY_KEYS: ReadonlySet<string> = new Set([
  'enabled',
  'x',
  'y',
  'currentWidth',
  'currentHeight',
  'zIndex',
]);

const isSameValue = (first: unknown, second: unknown): boolean => {
  if (first === second) return true;

  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((item, index) => isSameValue(item, second[index]))
    );
  }

  if (isPlainObject(first) && isPlainObject(second)) {
    const firstKeys = Object.keys(first);
    const secondKeys = Object.keys(second);

    return (
      firstKeys.length === secondKeys.length &&
      firstKeys.every((key) => isSameValue(first[key], second[key]))
    );
  }

  return false;
};

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** The settings of a widget that differ from what its manifest ships. */
const overridesOf = (
  type: string,
  userSettings: WidgetUserSettings
): Record<string, unknown> => {
  const shipped = DEFAULT_WIDGET_BY_ID.get(type)?.userSettings as
    | Record<string, unknown>
    | undefined;
  const current = userSettings as unknown as Record<string, unknown>;
  const overrides: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    if (GEOMETRY_KEYS.has(key) || value === undefined) continue;

    // A key the manifest does not ship is gone from the widget; reading it
    // back would drop it anyway, so there is nothing to keep.
    if (!shipped || !(key in shipped)) continue;

    if (!isSameValue(value, shipped[key])) {
      overrides[key] = value;
    }
  }

  return overrides;
};

/**
 * The design size a widget gets when the file says nothing about it: the
 * manifest's, with the width the widget's own settings derive when it derives
 * one.
 */
const designWithoutOverride = (
  type: string,
  userSettings: WidgetUserSettings
): StoredDesignSize | null => {
  const shipped = DEFAULT_WIDGET_BY_ID.get(type);

  if (!shipped) return null;

  const derive = WIDGET_BY_ID.get(type)?.deriveDesignWidth;
  const hasLockedRatio = !!shipped.lockAspectRatio && shipped.designWidth > 0;

  return {
    width:
      derive && !hasLockedRatio
        ? Math.max(1, derive(userSettings))
        : shipped.designWidth,
    height: shipped.designHeight,
  };
};

const designOverrideOf = (
  widget: WidgetDefaultConfig
): StoredDesignSize | undefined => {
  const expected = designWithoutOverride(widget.type, widget.userSettings);

  if (
    expected &&
    expected.width === widget.designWidth &&
    expected.height === widget.designHeight
  ) {
    return undefined;
  }

  return { width: widget.designWidth, height: widget.designHeight };
};

interface DecodedShape {
  userSettings: WidgetUserSettings;
  designWidth: number;
  designHeight: number;
}

/**
 * Settings and design size as the widget is drawn, from what the file holds:
 * the overrides merged over the manifest, the geometry laid on top, and the
 * design size repaired the way the widget's shape demands.
 *
 * A locked ratio is part of the widget's shape, not a resize preference: a
 * file written before the widget locked it (or edited by hand) would otherwise
 * render at a size the widget cannot draw. A table whose width is the sum of
 * its columns derives that width; when a stored size disagrees, the widget
 * keeps the size the user gave it — `currentWidth` is rescaled by the same
 * factor, so `--wfs`, and with it the text, does not move.
 */
const decodeShape = (
  shipped: WidgetDefaultConfig,
  settings: unknown,
  geometry: Partial<WidgetUserSettings>,
  design: StoredDesignSize | undefined
): DecodedShape => {
  const userSettings = {
    ...mergeWithDefaults(
      shipped.userSettings,
      isPlainObject(settings) ? settings : {}
    ),
    ...geometry,
  } as WidgetUserSettings;

  const hasLockedRatio = !!shipped.lockAspectRatio && shipped.designWidth > 0;

  if (hasLockedRatio) {
    userSettings.currentHeight = Math.round(
      userSettings.currentWidth * (shipped.designHeight / shipped.designWidth)
    );

    return {
      userSettings,
      designWidth: shipped.designWidth,
      designHeight: shipped.designHeight,
    };
  }

  const storedWidth = finiteOr(design?.width, shipped.designWidth);
  const storedHeight = finiteOr(design?.height, shipped.designHeight);
  const derive = WIDGET_BY_ID.get(shipped.id)?.deriveDesignWidth;

  if (!derive) {
    return {
      userSettings,
      designWidth: storedWidth,
      designHeight: storedHeight,
    };
  }

  const derivedWidth = Math.max(1, derive(userSettings));

  // No design size on disk means the one the settings derive — that is when
  // `encodeWidget` leaves it out. Rescaling against the manifest's width here
  // would grow the widget on every load.
  if (design && storedWidth > 0 && derivedWidth !== storedWidth) {
    userSettings.currentWidth = Math.round(
      (userSettings.currentWidth / storedWidth) * derivedWidth
    );
  }

  return {
    userSettings,
    designWidth: derivedWidth,
    designHeight: storedHeight,
  };
};

/** The manifest's own record, without the settings a widget brings itself. */
const metaOf = (shipped: WidgetDefaultConfig) => {
  const { userSettings: _shippedSettings, ...meta } = shipped;

  return meta;
};

export const encodeWidget = (
  widget: WidgetDefaultConfig,
  origin: Pick<MonitorBounds, 'x' | 'y'>
): StoredWidget => {
  const { userSettings } = widget;
  const design = designOverrideOf(widget);

  return {
    id: widget.id,
    type: widget.type,
    enabled: userSettings.enabled === true,
    frame: {
      x: userSettings.x - origin.x,
      y: userSettings.y - origin.y,
      width: userSettings.currentWidth,
      height: userSettings.currentHeight,
      ...(userSettings.zIndex === undefined ? {} : { z: userSettings.zIndex }),
    },
    ...(design ? { design } : {}),
    settings: overridesOf(widget.type, userSettings),
  };
};

/**
 * A widget read back onto its monitor, in desktop-wide coordinates. Null for a
 * widget this build no longer ships.
 */
export const decodeWidget = (
  stored: StoredWidget,
  monitor: LayoutMonitor
): WidgetDefaultConfig | null => {
  const shipped = DEFAULT_WIDGET_BY_ID.get(stored.type);

  if (!shipped) return null;

  const frame: Partial<StoredFrame> = isPlainObject(stored.frame)
    ? stored.frame
    : {};
  const { userSettings: shippedSettings } = shipped;
  const zIndex = typeof frame.z === 'number' ? frame.z : shippedSettings.zIndex;

  const shape = decodeShape(
    shipped,
    stored.settings,
    {
      enabled: stored.enabled === true,
      x: monitor.bounds.x + finiteOr(frame.x, shippedSettings.x),
      y: monitor.bounds.y + finiteOr(frame.y, shippedSettings.y),
      currentWidth: finiteOr(frame.width, shippedSettings.currentWidth),
      currentHeight: finiteOr(frame.height, shippedSettings.currentHeight),
      ...(zIndex === undefined ? {} : { zIndex }),
    },
    stored.design
  );

  return {
    ...metaOf(shipped),
    id: String(stored.id),
    type: shipped.id,
    monitor: monitor.name,
    ...shape,
  };
};

export const encodeTemplate = (widget: WidgetDefaultConfig): StoredTemplate => {
  const design = designOverrideOf(widget);

  return {
    enabled: widget.userSettings.enabled === true,
    size: {
      width: widget.userSettings.currentWidth,
      height: widget.userSettings.currentHeight,
    },
    ...(design ? { design } : {}),
    settings: overridesOf(widget.type, widget.userSettings),
  };
};

/**
 * Every template the build ships, with the file's choices laid over it. A
 * widget the file has no template for gets the manifest as it is.
 */
export const decodeTemplates = (
  stored: Record<string, StoredTemplate> | undefined
): WidgetDefaultConfig[] =>
  Array.from(DEFAULT_WIDGET_BY_ID.values()).map((shipped) => {
    const template = stored?.[shipped.id];

    if (!isPlainObject(template)) {
      return { ...shipped, userSettings: { ...shipped.userSettings } };
    }

    const size: Partial<StoredTemplate['size']> = isPlainObject(template.size)
      ? template.size
      : {};
    const { userSettings: shippedSettings } = shipped;

    const shape = decodeShape(
      shipped,
      template.settings,
      {
        enabled: template.enabled === true,
        currentWidth: finiteOr(size.width, shippedSettings.currentWidth),
        currentHeight: finiteOr(size.height, shippedSettings.currentHeight),
      },
      template.design
    );

    return { ...metaOf(shipped), ...shape };
  });

export const encodeTemplates = (
  templates: Iterable<WidgetDefaultConfig>
): Record<string, StoredTemplate> =>
  Object.fromEntries(
    Array.from(templates, (widget) => [widget.type, encodeTemplate(widget)])
  );

export const encodeLayout = (layout: SavedLayout): StoredLayout => {
  // Every widget belongs to a monitor of its layout once installed. One that
  // names none — a record written straight into a layout that was never
  // loaded — goes with the primary monitor rather than being lost.
  const fallbackName = primaryMonitorOf(layout)?.name;
  const ownerOf = (widget: WidgetDefaultConfig) =>
    layout.monitors.some((monitor) => monitor.name === widget.monitor)
      ? widget.monitor
      : fallbackName;

  return {
    id: layout.id,
    name: layout.name,
    createdAt: layout.createdAt,
    ...(layout.primaryMonitor === undefined
      ? {}
      : { primaryMonitor: layout.primaryMonitor }),
    monitors: layout.monitors.map((monitor) => {
      const backgroundImage = layout.backgroundImages?.[monitor.name];

      return {
        ...cloneMonitor(monitor),
        ...(backgroundImage ? { backgroundImage } : {}),
        widgets: layout.widgets
          .filter((widget) => ownerOf(widget) === monitor.name)
          .map((widget) => encodeWidget(widget, monitor.bounds)),
      };
    }),
  };
};

export const decodeLayout = (stored: StoredLayout): SavedLayout => {
  const storedMonitors = Array.isArray(stored.monitors) ? stored.monitors : [];
  const backgroundImages: Record<string, string> = {};
  const monitors: LayoutMonitor[] = [];
  const widgets: WidgetDefaultConfig[] = [];

  for (const storedMonitor of storedMonitors) {
    const monitor = cloneMonitor(storedMonitor);

    monitors.push(monitor);

    if (storedMonitor.backgroundImage) {
      backgroundImages[monitor.name] = storedMonitor.backgroundImage;
    }

    for (const storedWidget of Array.isArray(storedMonitor.widgets)
      ? storedMonitor.widgets
      : []) {
      const widget = decodeWidget(storedWidget, monitor);

      if (widget) {
        widgets.push(widget);
      }
    }
  }

  return {
    id: stored.id,
    name: stored.name,
    createdAt: stored.createdAt,
    backgroundImages,
    monitors,
    ...(stored.primaryMonitor === undefined
      ? {}
      : { primaryMonitor: stored.primaryMonitor }),
    widgets,
  };
};

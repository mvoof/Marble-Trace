import { makeAutoObservable, runInAction } from 'mobx';

import { cloneBackgroundImage } from '@utils/widget/layout-background';
import {
  monitorForWidget,
  monitorsBounds,
  placeWidgetOnMonitor,
  widgetsOnMonitor,
} from '@utils/widget/virtual-desktop';
import type {
  LayoutMonitor,
  SavedLayout,
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

const DEFAULT_LAYOUT_NAME = 'Default';

// Parks a monitor the machine no longer has to the right of every attached
// screen. Its placeholder bounds would otherwise sit on top of a real monitor
// in desktop space, and the centre-point test would hand its widgets over to
// whichever screen it collided with.
const parkedBounds = (
  attached: LayoutMonitor[],
  monitor: LayoutMonitor,
  alreadyParked: LayoutMonitor[]
) => {
  const occupied = [...attached, ...alreadyParked];

  if (occupied.length === 0) {
    return { ...monitor.bounds, x: 0, y: 0 };
  }

  const right = Math.max(
    ...occupied.map((candidate) => candidate.bounds.x + candidate.bounds.width)
  );

  return { ...monitor.bounds, x: right, y: 0 };
};

/**
 * The saved layout records: which layouts exist, which one is active, which one
 * each session context maps to, and the monitors and background images each
 * layout carries.
 *
 * Deliberately knows nothing about the live widget map the overlay renders —
 * everything here operates on stored records only, so the dependency runs one
 * way: `WidgetSettingsStore` → `LayoutsStore`. Operations that also have to
 * touch the live widgets (loading, committing, deleting the active layout) are
 * orchestrated by `WidgetSettingsStore`, which calls into this store for the
 * record half.
 */
export class LayoutsStore {
  layouts: SavedLayout[] = [];
  activeLayoutId: string | null = null;

  sessionLayouts: Record<SessionContext, string | null> = {
    Practice: null,
    Qualify: null,
    Race: null,
    Garage: null,
  };

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get activeLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.activeLayoutId);
  }

  byId(id: string): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === id);
  }

  setLayouts(layouts: SavedLayout[], activeLayoutId?: string | null) {
    this.layouts = layouts;

    if (activeLayoutId !== undefined) {
      this.activeLayoutId = activeLayoutId;
    }
  }

  setActiveLayoutId(id: string | null) {
    this.activeLayoutId = id;
  }

  setSessionLayout(context: SessionContext, layoutId: string | null) {
    this.sessionLayouts[context] = layoutId;
  }

  setSessionLayouts(layouts: Partial<Record<SessionContext, string | null>>) {
    this.sessionLayouts = {
      Practice: null,
      Qualify: null,
      Race: null,
      Garage: null,
      ...layouts,
    };
  }

  /** Creates an empty layout record and returns its id. */
  addLayout(name: string): string {
    const id = crypto.randomUUID();

    this.layouts = [
      ...this.layouts,
      {
        id,
        name: name.trim(),
        createdAt: Date.now(),
        monitors: [],
        widgets: [],
        backgroundImages: {},
      },
    ];

    return id;
  }

  /**
   * First-run layout, anchored to nothing yet — the caller resolves the primary
   * monitor asynchronously and fills it in. Returns the id, or null when
   * layouts already exist.
   */
  createDefaultLayout(): string | null {
    if (this.layouts.length > 0) {
      if (!this.activeLayoutId) {
        this.activeLayoutId = this.layouts[0].id;
      }

      return null;
    }

    const id = this.addLayout(DEFAULT_LAYOUT_NAME);

    this.activeLayoutId = id;
    this.sessionLayouts = {
      Practice: id,
      Qualify: id,
      Race: id,
      Garage: null,
    };

    return id;
  }

  renameLayout(id: string, name: string) {
    const layout = this.byId(id);

    if (!layout) return;

    layout.name = name.trim();
  }

  /** Drops the record. The caller decides what becomes active afterwards. */
  removeLayout(id: string) {
    this.layouts = this.layouts.filter((layout) => layout.id !== id);
  }

  setLayoutWidgets(id: string, widgets: WidgetDefaultConfig[]) {
    const layout = this.byId(id);

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = widgets;
  }

  async cloneLayout(id: string): Promise<string | undefined> {
    const layout = this.byId(id);

    if (!layout) return;

    const newId = crypto.randomUUID();
    const backgroundImages: Record<string, string> = {};

    for (const [monitorName, image] of Object.entries(
      layout.backgroundImages ?? {}
    )) {
      const copied = await cloneBackgroundImage(image, newId).catch(
        (error: unknown) => {
          console.error('Failed to clone background image:', error);

          return undefined;
        }
      );

      if (copied) {
        backgroundImages[monitorName] = copied;
      }
    }

    const cloned: SavedLayout = {
      id: newId,
      name: `${layout.name} (Copy)`,
      createdAt: Date.now(),
      backgroundImages,
      monitors: layout.monitors.map((monitor) => ({
        name: monitor.name,
        bounds: { ...monitor.bounds },
      })),
      widgets: layout.widgets.map((widget) => ({
        ...widget,
        userSettings: { ...widget.userSettings },
      })),
    };

    runInAction(() => {
      this.layouts = [...this.layouts, cloned];
    });

    return newId;
  }

  // ── Monitors of a layout ────────────────────────────────────────────────

  /** Rectangle covering every monitor of the active layout. */
  get desktopBounds() {
    return monitorsBounds(this.activeLayout?.monitors ?? []);
  }

  /** Monitors the active layout covers, empty ones included. */
  get activeMonitorNames(): string[] {
    return (this.activeLayout?.monitors ?? []).map((monitor) => monitor.name);
  }

  monitorByName(monitorName: string): LayoutMonitor | undefined {
    return this.activeLayout?.monitors.find(
      (monitor) => monitor.name === monitorName
    );
  }

  setMonitors(id: string, monitors: LayoutMonitor[]) {
    const layout = this.byId(id);

    if (!layout) return;

    layout.monitors = monitors.map((monitor) => ({
      name: monitor.name,
      bounds: { ...monitor.bounds },
    }));
  }

  /**
   * Adds a monitor to the active layout, extending the area widgets can be
   * dragged onto. Existing widgets are untouched — the new screen starts empty.
   */
  addMonitor(monitor: LayoutMonitor) {
    const layout = this.activeLayout;

    if (!layout) return;

    if (layout.monitors.some((existing) => existing.name === monitor.name)) {
      return;
    }

    layout.monitors = [
      ...layout.monitors,
      { name: monitor.name, bounds: { ...monitor.bounds } },
    ];
  }

  /**
   * Drops a monitor from a layout. Its overlay window closes on the next window
   * sync, and the widgets that lived on it move to the first remaining monitor
   * rather than being deleted — losing them to a mis-click would be
   * unrecoverable. Returns the layout so the caller can refresh live widgets.
   */
  removeMonitor(
    layoutId: string,
    monitorName: string
  ): SavedLayout | undefined {
    const layout = this.byId(layoutId);
    const removed = layout?.monitors.find(
      (monitor) => monitor.name === monitorName
    );

    if (!layout || !removed) return;

    const remaining = layout.monitors.filter(
      (monitor) => monitor.name !== monitorName
    );

    const orphans = new Set(
      widgetsOnMonitor(layout.widgets, monitorName, layout.monitors).map(
        (widget) => widget.id
      )
    );

    layout.monitors = remaining;

    const fallback = remaining[0];

    layout.widgets = layout.widgets.map((widget) =>
      orphans.has(widget.id) && fallback
        ? placeWidgetOnMonitor(widget, removed.bounds, fallback.bounds)
        : widget
    );

    delete layout.backgroundImages?.[monitorName];

    return layout;
  }

  /**
   * Puts every layout's monitors where the OS says they actually are, moving
   * their widgets along with them. Runs on startup and whenever the display
   * arrangement changes.
   *
   * Migrated layouts arrive with monitors laid out side by side from x=0,
   * because the persisted settings never recorded desktop positions. This is
   * the step that turns those placeholders into real coordinates — until it
   * runs, a layout's widgets are in the right order but the wrong place.
   */
  alignMonitorsToHardware(attached: LayoutMonitor[]) {
    const byName = new Map(
      attached.map((monitor) => [monitor.name, monitor] as const)
    );

    for (const layout of this.layouts) {
      if (layout.monitors.length === 0) continue;

      // Which monitor each widget belongs to has to be resolved against the
      // OLD bounds — once a monitor moves, the centre-point test would report
      // the widget as belonging to whatever now covers its stale position.
      const ownerByWidget = new Map<WidgetDefaultConfig, string>();

      for (const widget of layout.widgets) {
        const owner = monitorForWidget(widget, layout.monitors);

        if (owner) {
          ownerByWidget.set(widget, owner.name);
        }
      }

      const previousBounds = new Map(
        layout.monitors.map((monitor) => [monitor.name, { ...monitor.bounds }])
      );

      const parked: LayoutMonitor[] = [];

      for (const monitor of layout.monitors) {
        const match = byName.get(monitor.name);

        if (match) {
          monitor.bounds = { ...match.bounds };
          continue;
        }

        monitor.bounds = parkedBounds(attached, monitor, parked);
        parked.push(monitor);
      }

      layout.widgets = layout.widgets.map((widget) => {
        const ownerName = ownerByWidget.get(widget);
        const from = ownerName ? previousBounds.get(ownerName) : undefined;
        const to = layout.monitors.find(
          (monitor) => monitor.name === ownerName
        )?.bounds;

        if (!from || !to) return widget;

        return placeWidgetOnMonitor(widget, from, to);
      });
    }
  }

  // ── Background images ───────────────────────────────────────────────────

  /**
   * Background shown behind widgets in the layout editor (e.g. a cockpit view)
   * so widgets can be placed relative to a virtual cockpit. Stored per monitor
   * on the layout; undefined clears it.
   */
  setMonitorBackground(monitorName: string, image: string | undefined) {
    const layout = this.activeLayout;

    if (!layout) return;

    const images = { ...(layout.backgroundImages ?? {}) };

    if (image) {
      images[monitorName] = image;
    } else {
      delete images[monitorName];
    }

    layout.backgroundImages = images;
  }

  /** Convenience that paints (or clears) every monitor of the active layout. */
  setActiveLayoutBackground(image: string | undefined) {
    const layout = this.activeLayout;

    if (!layout) return;

    for (const monitor of layout.monitors) {
      this.setMonitorBackground(monitor.name, image);
    }
  }
}

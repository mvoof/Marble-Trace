import { makeAutoObservable, runInAction } from 'mobx';

import { cloneBackgroundImage } from '@store/settings/layout-background';
import {
  monitorForWidget,
  monitorsBounds,
  placeWidgetOnMonitor,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';
import {
  cloneMonitor,
  isDisplayMonitor,
  isRemoteMonitor,
} from '@utils/remote-screen';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
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
  editingLayoutId: string | null = null;

  sessionLayouts: Record<SessionContext, string | null> = {
    Practice: null,
    Qualify: null,
    Race: null,
    Garage: null,
  };

  /**
   * Every write below marks itself in the log, so a caller cannot make one that
   * never reaches disk. A layout write always marks the whole widget map: the
   * records it changes are what the widgets stand on, and after one of them
   * moves no patch describes where they are.
   */
  constructor(private readonly mutations: SettingsMutationLog) {
    makeAutoObservable<LayoutsStore, 'mutations'>(
      this,
      { mutations: false },
      { autoBind: true }
    );
  }

  /**
   * The layout the overlay is rendering, when that is not the one being edited.
   *
   * Null whenever the two are the same, which is every moment the layout editor
   * is closed. While it is open the two part company on purpose: the editor
   * keeps whatever layout the user opened, and the session auto-switch moves
   * this one instead, so the screen the driver races on always matches the
   * session even mid-edit.
   */
  pinnedLiveLayoutId: string | null = null;

  get editingLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.editingLayoutId);
  }

  /** What is on screen — the live layout while one is pinned, else the edited one. */
  get liveLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.liveLayoutId);
  }

  get liveLayoutId(): string | null {
    return this.pinnedLiveLayoutId ?? this.editingLayoutId;
  }

  setPinnedLiveLayoutId(id: string | null) {
    this.pinnedLiveLayoutId = id;
    this.mutations.recordEveryWidget();
  }

  byId(id: string): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === id);
  }

  setLayouts(layouts: SavedLayout[], editingLayoutId?: string | null) {
    this.layouts = layouts;

    if (editingLayoutId !== undefined) {
      this.editingLayoutId = editingLayoutId;
    }

    this.mutations.recordEveryWidget();
  }

  setEditingLayoutId(id: string | null) {
    this.editingLayoutId = id;
    this.mutations.recordEveryWidget();
  }

  setSessionLayout(context: SessionContext, layoutId: string | null) {
    this.sessionLayouts[context] = layoutId;
    this.mutations.recordEveryWidget();
  }

  setSessionLayouts(layouts: Partial<Record<SessionContext, string | null>>) {
    this.sessionLayouts = {
      Practice: null,
      Qualify: null,
      Race: null,
      Garage: null,
      ...layouts,
    };

    this.mutations.recordEveryWidget();
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

    this.mutations.recordEveryWidget();

    return id;
  }

  /**
   * First-run layout, anchored to nothing yet — the caller resolves the primary
   * monitor asynchronously and fills it in. Returns the id, or null when
   * layouts already exist.
   */
  createDefaultLayout(): string | null {
    if (this.layouts.length > 0) {
      if (!this.editingLayoutId) {
        this.editingLayoutId = this.layouts[0].id;
      }

      return null;
    }

    const id = this.addLayout(DEFAULT_LAYOUT_NAME);

    this.editingLayoutId = id;
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
    this.mutations.recordEveryWidget();
  }

  /** Drops the record. The caller decides what becomes active afterwards. */
  removeLayout(id: string) {
    this.layouts = this.layouts.filter((layout) => layout.id !== id);
    this.mutations.recordEveryWidget();
  }

  setLayoutWidgets(id: string, widgets: WidgetDefaultConfig[]) {
    const layout = this.byId(id);

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = widgets;
    this.mutations.recordEveryWidget();
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
      monitors: layout.monitors.map(cloneMonitor),
      widgets: layout.widgets.map((widget) => ({
        ...widget,
        userSettings: { ...widget.userSettings },
      })),
    };

    runInAction(() => {
      this.layouts = [...this.layouts, cloned];
      this.mutations.recordEveryWidget();
    });

    return newId;
  }

  // ── Monitors of a layout ────────────────────────────────────────────────

  /** Rectangle covering every monitor of the active layout. */
  get desktopBounds() {
    return monitorsBounds(this.editingLayout?.monitors ?? []);
  }

  /** Monitors the active layout covers, empty ones included. */
  // Remote screens are excluded: they are monitors for layout purposes, but no
  // overlay window is ever opened for one.
  get editingMonitorNames(): string[] {
    return (this.editingLayout?.monitors ?? [])
      .filter(isDisplayMonitor)
      .map((monitor) => monitor.name);
  }

  /** The same, for the layout actually on screen — see `pinnedLiveLayoutId`. */
  get liveMonitorNames(): string[] {
    return (this.liveLayout?.monitors ?? [])
      .filter(isDisplayMonitor)
      .map((monitor) => monitor.name);
  }

  get editingRemoteScreens(): LayoutMonitor[] {
    return (this.editingLayout?.monitors ?? []).filter(isRemoteMonitor);
  }

  /** The same, for the layout actually on screen — see `pinnedLiveLayoutId`. */
  get liveRemoteScreens(): LayoutMonitor[] {
    return (this.liveLayout?.monitors ?? []).filter(isRemoteMonitor);
  }

  monitorByName(monitorName: string): LayoutMonitor | undefined {
    return this.editingLayout?.monitors.find(
      (monitor) => monitor.name === monitorName
    );
  }

  setMonitors(id: string, monitors: LayoutMonitor[]) {
    const layout = this.byId(id);

    if (!layout) return;

    layout.monitors = monitors.map(cloneMonitor);
    this.mutations.recordEveryWidget();
  }

  /**
   * Adds a monitor to the active layout, extending the area widgets can be
   * dragged onto. Existing widgets are untouched — the new screen starts empty.
   */
  addMonitor(monitor: LayoutMonitor) {
    const layout = this.editingLayout;

    if (!layout) return;

    if (layout.monitors.some((existing) => existing.name === monitor.name)) {
      return;
    }

    // Rebuilt rather than stored by reference, so a caller cannot keep a handle
    // on the layout's copy — but `kind` and `slug` have to survive it, or a
    // remote screen would come back as a display with no device behind it.
    layout.monitors = [...layout.monitors, cloneMonitor(monitor)];
    this.mutations.recordEveryWidget();
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
    this.mutations.recordEveryWidget();

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
        // A remote screen is never attached and must never be parked: its
        // bounds are the device size the user chose. It still counts as
        // occupied space so a parked display does not land on top of it.
        if (isRemoteMonitor(monitor)) {
          parked.push(monitor);
          continue;
        }

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

    this.mutations.recordEveryWidget();
  }

  // ── Background images ───────────────────────────────────────────────────

  /**
   * Background shown behind widgets in the layout editor (e.g. a cockpit view)
   * so widgets can be placed relative to a virtual cockpit. Stored per monitor
   * on the layout; undefined clears it.
   */
  setMonitorBackground(monitorName: string, image: string | undefined) {
    const layout = this.editingLayout;

    if (!layout) return;

    const images = { ...(layout.backgroundImages ?? {}) };

    if (image) {
      images[monitorName] = image;
    } else {
      delete images[monitorName];
    }

    layout.backgroundImages = images;
    this.mutations.recordEveryWidget();
  }

  /** Convenience that paints (or clears) every monitor of the active layout. */
  setActiveLayoutBackground(image: string | undefined) {
    const layout = this.editingLayout;

    if (!layout) return;

    for (const monitor of layout.monitors) {
      this.setMonitorBackground(monitor.name, image);
    }
  }
}

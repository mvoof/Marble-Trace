import { makeAutoObservable, runInAction } from 'mobx';

import { cloneBackgroundImage } from '@store/settings/layout-background';
import {
  monitorForWidget,
  monitorsBounds,
  placeWidgetOnMonitor,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';
import {
  boundsOverlap,
  clearOfMonitors,
  cloneMonitor,
  isDisplayMonitor,
  isRemoteMonitor,
  nextRemoteBounds,
  remoteScreenGrid,
  slugFromName,
  uniqueSlug,
} from '@utils/remote-screen';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
import type {
  LayoutMonitor,
  SavedLayout,
  SessionContext,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

export interface RemoteScreenDescriptor {
  layoutId: string;
  layoutName: string;
  isLive: boolean;
  sessionContexts: SessionContext[];
  screen: LayoutMonitor;
}

export interface RemoteScreenUsage {
  layoutId: string;
  layoutName: string;
  isLive: boolean;
  sessionContexts: SessionContext[];
  screen: LayoutMonitor;
}

export interface GroupedRemoteScreen {
  slug: string;
  name: string;
  screen: LayoutMonitor;
  isLive: boolean;
  activeLayoutName?: string;
  layouts: RemoteScreenUsage[];
}

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
 * The lifecycle of a record lives here — creating, deleting, renaming and
 * duplicating one — and so does the topology of the screens it stands on:
 * adding, moving, resizing, arranging and removing them. A remote screen is a
 * monitor with no display behind it, so it is managed here beside the
 * monitors rather than in the widget map.
 *
 * Nothing here reaches out to the live widget map. A record change that also
 * has to reach what is on screen is a *gesture*, and gestures are functions in
 * `layout-gestures.ts` that hold both sides — which is what keeps the
 * dependency between records and map pointing one way. A screen that moves
 * needs no gesture at all: it carries its widgets by writing to the record's
 * own widget objects, which the map projects rather than copies — see
 * `carryWidgets`.
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

  get editingLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.editingLayoutId);
  }

  /** What is on screen — the live layout while one is pinned, else the edited one. */
  get liveLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.liveLayoutId);
  }

  /**
   * The layout the overlay is rendering while the editor holds another one, or
   * null whenever the two are the same.
   *
   * It lives here rather than in `LayoutEditorStore` because it is the same
   * kind of value as `editingLayoutId` — a pointer into the record set,
   * answering "which layout is the application looking at". The editor only
   * *moves* it, and it is read by callers that have no editor at all
   * (persistence, remote publishing, the overlay window watcher).
   */
  pinnedLiveLayoutId: string | null = null;

  setPinnedLiveLayoutId(id: string | null) {
    this.pinnedLiveLayoutId = id;
    this.mutations.recordEveryWidget();
  }

  /** What the overlay renders: the pinned layout while there is one, else the edited one. */
  get liveLayoutId(): string | null {
    return this.pinnedLiveLayoutId ?? this.editingLayoutId;
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

  /**
   * Anchors a layout that has none to the screen the hardware just named, and
   * answers whether it took: a layout that gained a monitor meanwhile is left
   * alone, and so is one that has been deleted.
   */
  anchorToMonitor(id: string, monitor: LayoutMonitor): boolean {
    const targetLayout = this.byId(id);

    if (!targetLayout || targetLayout.monitors.length > 0) return false;

    this.setMonitors(id, [monitor]);

    return true;
  }

  /**
   * Drops the record, releasing the pin first when it names this layout — a
   * pin to a deleted record would leave the overlay speaking for a layout that
   * no longer exists. What becomes active afterwards is the caller's, so that
   * the fallback's widgets can be loaded before the mutation token moves.
   */
  detachLayout(id: string) {
    if (this.pinnedLiveLayoutId === id) {
      this.setPinnedLiveLayoutId(null);
    }

    this.removeLayout(id);
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

  /** The same, for the layout actually on screen — see `liveLayoutId`. */
  get liveMonitorNames(): string[] {
    return (this.liveLayout?.monitors ?? [])
      .filter(isDisplayMonitor)
      .map((monitor) => monitor.name);
  }

  get editingRemoteScreens(): LayoutMonitor[] {
    return (this.editingLayout?.monitors ?? []).filter(isRemoteMonitor);
  }

  /** The same, for the layout actually on screen — see `liveLayoutId`. */
  get liveRemoteScreens(): LayoutMonitor[] {
    return (this.liveLayout?.monitors ?? []).filter(isRemoteMonitor);
  }

  /** All remote screens configured across all saved layouts with layout metadata. */
  get allRemoteScreens(): RemoteScreenDescriptor[] {
    const descriptors: RemoteScreenDescriptor[] = [];
    const liveId = this.liveLayoutId;

    for (const layout of this.layouts) {
      const isLive = layout.id === liveId;
      const sessionContexts: SessionContext[] = (
        Object.entries(this.sessionLayouts) as [SessionContext, string | null][]
      )
        .filter(([, id]) => id === layout.id)
        .map(([ctx]) => ctx);

      for (const monitor of layout.monitors) {
        if (isRemoteMonitor(monitor)) {
          descriptors.push({
            screen: monitor,
            layoutId: layout.id,
            layoutName: layout.name,
            isLive,
            sessionContexts,
          });
        }
      }
    }

    return descriptors;
  }

  /**
   * Remote screens grouped by slug across all layouts.
   * Gives a unified view of each device/URL screen, including all layouts
   * where it is used.
   */
  get groupedRemoteScreens(): GroupedRemoteScreen[] {
    const liveId = this.liveLayoutId;
    const sessionMap = this.sessionLayouts;
    const groups = new Map<string, GroupedRemoteScreen>();

    for (const layout of this.layouts) {
      const isLive = layout.id === liveId;
      const sessionContexts: SessionContext[] = (
        Object.entries(sessionMap) as [SessionContext, string | null][]
      )
        .filter(([, id]) => id === layout.id)
        .map(([ctx]) => ctx);

      for (const monitor of layout.monitors) {
        if (!isRemoteMonitor(monitor) || !monitor.slug) {
          continue;
        }

        const slug = monitor.slug;
        const usage: RemoteScreenUsage = {
          layoutId: layout.id,
          layoutName: layout.name,
          isLive,
          sessionContexts,
          screen: monitor,
        };

        const existing = groups.get(slug);
        if (!existing) {
          groups.set(slug, {
            slug,
            name: monitor.name,
            screen: monitor,
            isLive,
            activeLayoutName: isLive ? layout.name : undefined,
            layouts: [usage],
          });
        } else {
          existing.layouts.push(usage);
          if (isLive) {
            existing.isLive = true;
            existing.activeLayoutName = layout.name;
            existing.screen = monitor;
            existing.name = monitor.name;
          }
        }
      }
    }

    return Array.from(groups.values());
  }

  /**
   * Unique remote screens configured in other layouts that are not yet
   * present in the currently edited layout.
   */
  get reusableRemoteScreens(): LayoutMonitor[] {
    const currentLayout = this.editingLayout;
    if (!currentLayout) return [];

    const currentSlugs = new Set(
      currentLayout.monitors
        .filter(isRemoteMonitor)
        .map((m) => m.slug)
        .filter((s): s is string => Boolean(s))
    );

    const seen = new Set<string>();
    const reusable: LayoutMonitor[] = [];

    for (const layout of this.layouts) {
      if (layout.id === currentLayout.id) continue;
      for (const monitor of layout.monitors) {
        if (
          isRemoteMonitor(monitor) &&
          monitor.slug &&
          !currentSlugs.has(monitor.slug) &&
          !seen.has(monitor.slug)
        ) {
          seen.add(monitor.slug);
          reusable.push(cloneMonitor(monitor));
        }
      }
    }

    return reusable;
  }

  /**
   * Finds the layout carrying a remote screen with this slug.
   * Prefers the live layout if it carries the screen, otherwise checks all layouts.
   */
  layoutForRemoteSlug(slug: string): SavedLayout | undefined {
    const live = this.liveLayout;
    if (live?.monitors.some((m) => isRemoteMonitor(m) && m.slug === slug)) {
      return live;
    }

    return this.layouts.find((layout) =>
      layout.monitors.some((m) => isRemoteMonitor(m) && m.slug === slug)
    );
  }

  /**
   * Finds a remote screen by its slug and the layout it belongs to.
   * Prefers the live layout if it carries this screen.
   */
  remoteScreenBySlug(
    slug: string
  ): { layout: SavedLayout; screen: LayoutMonitor } | undefined {
    const layout = this.layoutForRemoteSlug(slug);
    if (!layout) return undefined;

    const screen = layout.monitors.find(
      (m) => isRemoteMonitor(m) && m.slug === slug
    );
    if (!screen) return undefined;

    return { layout, screen };
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
   * unrecoverable.
   *
   * The widget list is rebuilt here, so the caller installs it: reach this
   * through the `removeMonitor` gesture rather than calling it directly.
   */
  removeMonitor(layoutId: string, monitorName: string) {
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
   *
   * Rebuilds the active layout's widget list, so the caller installs it: reach
   * this through the `alignMonitorsToHardware` gesture.
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

  // ── Remote screens ──────────────────────────────────────────────────────

  /**
   * Carries the widgets standing on a screen along with it.
   *
   * They are the layout record's own widget objects, which the live map
   * projects rather than copies, so moving them here is what puts them on
   * screen — nothing has to be handed over afterwards. A rebuilt widget *list*
   * is the other case, and that one does go through the map.
   */
  private carryWidgets(carried: WidgetDefaultConfig[], dx: number, dy: number) {
    for (const widget of carried) {
      widget.userSettings.x += dx;
      widget.userSettings.y += dy;
    }
  }

  /**
   * Adds a device screen to the active layout. It is a monitor in every way
   * that matters for the layout — widgets belong to it by their centre point,
   * it gets its own widget set — but the machine has no display behind it, so
   * it is parked in free desktop space and never gets an overlay window.
   */
  addRemoteScreen(
    name: string,
    width: number,
    height: number,
    background?: string
  ) {
    const layout = this.editingLayout;

    if (!layout) return;

    const slug = uniqueSlug(
      slugFromName(name),
      layout.monitors.map((monitor) => monitor.slug ?? '')
    );

    this.addMonitor({
      name,
      kind: 'remote',
      slug,
      bounds: nextRemoteBounds(layout.monitors, width, height),
      ...(background ? { background } : {}),
    });
  }

  /** What a remote screen paints behind its widgets: a CSS color, or
   *  `'transparent'` for a browser source compositing over a game capture. */
  setRemoteScreenBackground(
    monitorName: string,
    background: string,
    layoutId?: string
  ) {
    const layout = layoutId ? this.byId(layoutId) : this.editingLayout;
    const monitor = layout?.monitors.find(
      (candidate) => candidate.name === monitorName
    );

    if (!monitor) return;

    monitor.background = background;
    this.mutations.recordEveryWidget();
  }

  /** Applied when a device reports a viewport that differs from the size the
   *  screen was drawn for. Never automatic: resizing moves every widget. */
  resizeRemoteScreen(
    monitorName: string,
    width: number,
    height: number,
    layoutId?: string
  ) {
    const layout = layoutId ? this.byId(layoutId) : this.editingLayout;
    const monitor = layout?.monitors.find(
      (candidate) => candidate.name === monitorName
    );

    if (!layout || !monitor) return;

    // Growing a screen in place can push it into its neighbours, which the
    // drag path refuses outright — the widened rectangle would take over the
    // widgets whose centres it now covers. It is slid clear the short way, and
    // its own widgets travel with it.
    const others = layout.monitors.filter(
      (candidate) => candidate.name !== monitorName
    );

    const grown = { ...monitor.bounds, width, height };
    const slid = clearOfMonitors(
      grown,
      others.map((candidate) => candidate.bounds)
    );

    // An arrangement dense enough to leave no room nearby falls back to the
    // free space every new screen is parked in.
    const landed = others.some((candidate) =>
      boundsOverlap(candidate.bounds, slid)
    )
      ? nextRemoteBounds(others, width, height)
      : slid;

    const carried = widgetsOnMonitor(
      layout.widgets,
      monitorName,
      layout.monitors
    );

    monitor.bounds = landed;
    this.carryWidgets(carried, landed.x - grown.x, landed.y - grown.y);

    this.mutations.recordEveryWidget();
  }

  /**
   * Adds an existing remote screen (from another layout) to the active layout,
   * preserving its name, slug, bounds (width/height), background and fitted status.
   */
  addExistingRemoteScreen(slug: string) {
    const layout = this.editingLayout;

    if (!layout) return;

    if (layout.monitors.some((m) => isRemoteMonitor(m) && m.slug === slug)) {
      return;
    }

    const template = this.remoteScreenBySlug(slug)?.screen;
    if (!template) return;

    this.addMonitor({
      name: template.name,
      kind: 'remote',
      slug: template.slug,
      bounds: nextRemoteBounds(
        layout.monitors,
        template.bounds.width,
        template.bounds.height
      ),
      ...(template.background ? { background: template.background } : {}),
      ...(template.fittedToDevice ? { fittedToDevice: true } : {}),
    });
  }

  /**
   * Updates background across all layouts that have a remote screen with this slug.
   */
  setRemoteScreenBackgroundBySlug(slug: string, background: string) {
    for (const layout of this.layouts) {
      const monitor = layout.monitors.find(
        (m) => isRemoteMonitor(m) && m.slug === slug
      );
      if (monitor) {
        this.setRemoteScreenBackground(monitor.name, background, layout.id);
      }
    }
  }

  /**
   * Resizes remote screens matching this slug across all layouts they appear in.
   */
  resizeRemoteScreenBySlug(slug: string, width: number, height: number) {
    for (const layout of this.layouts) {
      const monitor = layout.monitors.find(
        (m) => isRemoteMonitor(m) && m.slug === slug
      );
      if (monitor) {
        this.resizeRemoteScreen(monitor.name, width, height, layout.id);
      }
    }
  }

  /**
   * Moves a remote screen across the virtual desktop, carrying its widgets with
   * it: widget coordinates are desktop-wide and a widget belongs to the monitor
   * containing its centre, so a screen that moved alone would leave every
   * widget behind on whatever rectangle they landed in. A move onto another
   * monitor is refused for the same reason — it would steal that screen's
   * widgets.
   *
   * Deliberately outside undo/redo: the history holds widget snapshots only, so
   * an undo here would put the widgets back and leave the screen moved.
   */
  moveRemoteScreen(monitorName: string, x: number, y: number) {
    const layout = this.editingLayout;

    if (!layout) return;

    const monitor = layout.monitors.find(
      (candidate) => candidate.name === monitorName
    );

    if (!monitor || !isRemoteMonitor(monitor)) return;

    const dx = x - monitor.bounds.x;
    const dy = y - monitor.bounds.y;

    if (dx === 0 && dy === 0) return;

    const target = { ...monitor.bounds, x, y };

    const collides = layout.monitors.some(
      (other) =>
        other.name !== monitorName && boundsOverlap(other.bounds, target)
    );

    if (collides) return;

    const carried = widgetsOnMonitor(
      layout.widgets,
      monitorName,
      layout.monitors
    );

    monitor.bounds = target;
    this.carryWidgets(carried, dx, dy);

    this.mutations.recordEveryWidget();
  }

  /**
   * Re-parks every remote screen in rows under the real desktop. New screens
   * are appended to the right of everything else, which turns a handful of them
   * into a strip too wide for the editor to show at a useful scale.
   */
  arrangeRemoteScreens() {
    const layout = this.editingLayout;

    if (!layout) return;

    const targets = remoteScreenGrid(layout.monitors);

    // Ownership is read against the arrangement as it stands, before any
    // rectangle moves — halfway through, a widget's centre could fall inside a
    // screen that has already been re-parked.
    const carried = new Map(
      Object.keys(targets).map((name) => [
        name,
        widgetsOnMonitor(layout.widgets, name, layout.monitors),
      ])
    );

    for (const monitor of layout.monitors) {
      const target = targets[monitor.name];

      if (!target) continue;

      const dx = target.x - monitor.bounds.x;
      const dy = target.y - monitor.bounds.y;

      monitor.bounds = target;
      this.carryWidgets(carried.get(monitor.name) ?? [], dx, dy);
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

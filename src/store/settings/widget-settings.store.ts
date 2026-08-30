import { makeAutoObservable, runInAction } from 'mobx';
import { mergeWithDefaults } from '@store/deep-merge';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from '@store/widget-catalog';
import {
  setFuelAvgWindowSilent,
  setPitWarningLapsSilent,
} from '@platform/services/settings.service';
import { resolveMonitorByName } from '@platform/sync/overlay-resolution';
import { LayoutsStore } from '@store/settings/layouts.store';
import {
  applyDerivedDesignWidth,
  applyLayoutResize,
  deriveWidgetDesignWidth,
} from '@store/settings/layout-resize';

import type {
  WidgetDefaultConfig,
  BaseUserSettings,
  FuelWidgetSettings,
  LayoutResolution,
  LayoutMonitor,
  SavedLayout,
  StandingsViewMode,
  StandingsWidgetSettings,
  WidgetSpecificSettings,
  WidgetUserSettings,
  SessionContext,
} from '@/types/widget-settings';
import { emitLayoutActivated } from '@platform/services/events.service';
import { DEFAULT_LAYOUT_RESOLUTION } from '@store/settings/layout-resolution';
import {
  monitorForWidget,
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
import { WidgetHistory } from '@store/settings/widget-history';
import {
  bottomZIndex,
  buildStarterWidgets,
  pickableWidgetsForMonitor,
  spotForAddedWidget,
  topZIndex,
  type PickableWidget,
} from '@store/settings/widget-placement';
import type { RootStore } from '@store/root-store';

const LAYOUT_TOAST_DURATION_MS = 3000;

export type { PickableWidget };

export class WidgetSettingsStore {
  // Live working copy of the ACTIVE layout. The overlay renders this; the layout
  // editor and F9 drag mode edit this.
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  readonly history = new WidgetHistory();

  /**
   * The saved layout records. Owned here so the two always construct together,
   * and exposed on RootStore as `root.layouts` for call sites that only need
   * the records. Everything below that reads or writes a layout goes through
   * it — this store keeps only the live working copy the overlay renders.
   */
  readonly layoutRecords = new LayoutsStore();

  // Monitors physically attached right now, refreshed by the arrangement
  // watcher. The editor offers these as screens a layout can be spread onto.
  attachedMonitors: LayoutMonitor[] = [];

  // Set in an overlay window to the monitor that window covers. Null in the
  // main window, which edits one monitor at a time via activeMonitorName.
  ownMonitorName: string | null = null;

  // Logical (CSS px) resolution of the overlay window. Set by the overlay after
  // positioning, and by selectMonitorForActiveLayout when the active config
  // changes. Drives the editor canvas scale.
  overlayResolution: LayoutResolution = { ...DEFAULT_LAYOUT_RESOLUTION };

  // Incremented on every settings mutation. Reactions use this as a cheap
  // change trigger instead of subscribing to every field across all widgets.
  changeToken = 0;

  // Incremented when settings arrive from the other window (overlay drag / F9).
  // Kept separate from changeToken so cross-window sync does NOT re-trigger the
  // emit/commit reactions (which would loop), while UI that needs to reflect
  // those external edits (the layout editor preview) can still react to it.
  syncToken = 0;

  // When true the editor is showing a layout that is NOT the overlay-active one.
  // The overlay-sync reaction skips emitting while this flag is set so the
  // overlay keeps displaying the previously-active layout.
  editorPreviewMode = false;

  // Widgets the overlay is actually rendering while the editor previews another
  // layout. Null whenever the live map already is the active layout.
  liveEnabledWidgetIds: string[] | null = null;

  // Name shown in the overlay's "layout switched" toast; null once it expires.
  layoutActivatedToast: string | null = null;

  private layoutToastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root?: RootStore) {
    makeAutoObservable<WidgetSettingsStore, 'layoutToastTimer'>(
      this,
      {
        layoutToastTimer: false,
      },
      {
        autoBind: true,
      }
    );
  }

  showLayoutActivatedToast(layoutName: string) {
    this.layoutActivatedToast = layoutName;

    if (this.layoutToastTimer !== null) {
      clearTimeout(this.layoutToastTimer);
    }

    this.layoutToastTimer = setTimeout(() => {
      runInAction(() => {
        this.layoutActivatedToast = null;
      });
    }, LAYOUT_TOAST_DURATION_MS);
  }

  get allWidgets(): WidgetDefaultConfig[] {
    return Array.from(this.widgets.values());
  }

  get availableWidgetIds(): string[] {
    const ids: string[] = [];
    const capabilities = this.root?.sim.capabilities;

    for (const widget of this.widgets.values()) {
      const config = WIDGET_BY_ID.get(widget.id);
      const reqs = config?.requiredCapabilities;

      if (!reqs || reqs.length === 0) {
        ids.push(widget.id);
        continue;
      }

      if (!capabilities) {
        ids.push(widget.id);
        continue;
      }

      const met = reqs.every((req) => capabilities[req] === true);

      if (met) {
        ids.push(widget.id);
      }
    }

    return ids;
  }

  get enabledWidgetIds(): string[] {
    const ids: string[] = [];
    const available = new Set(this.availableWidgetIds);

    for (const widget of this.widgets.values()) {
      if (widget.userSettings.enabled && available.has(widget.id)) {
        ids.push(widget.id);
      }
    }

    return ids.sort((a, b) => {
      const widgetA = this.getWidget(a);
      const widgetB = this.getWidget(b);
      const zA = widgetA?.userSettings.zIndex ?? 0;
      const zB = widgetB?.userSettings.zIndex ?? 0;
      return zA - zB;
    });
  }

  /**
   * Whether a widget is actually on screen right now — enabled in the layout the
   * overlay is rendering, and supported by the connected sim. Everything a
   * widget owns is gated on this: its bindings, and its background work such as
   * the pit-service auto order.
   *
   * "On screen" and "in the editor" differ during a layout preview, and this
   * follows the overlay: previewing a layout without the pit-service widget must
   * not switch off automatic pit orders for the layout the driver is racing.
   */
  isWidgetInActiveLayout(widgetId: string): boolean {
    const live = this.liveEnabledWidgetIds ?? this.enabledWidgetIds;

    return live.includes(widgetId);
  }

  cycleStandingsViewMode() {
    const settings = this.getSettings<StandingsWidgetSettings>('standings');
    const order: StandingsViewMode[] = ['all', 'grouped', 'cycling'];
    const currentIdx = order.indexOf(settings.viewMode);
    const nextIdx = (currentIdx + 1) % order.length;

    this.updateUserSettings('standings', {
      viewMode: order[nextIdx],
    });
  }

  setSessionLayout(context: SessionContext, layoutId: string | null) {
    this.layoutRecords.setSessionLayout(context, layoutId);
    this.bumpMutation();
  }

  setSessionLayouts(layouts: Partial<Record<SessionContext, string | null>>) {
    this.layoutRecords.setSessionLayouts(layouts);
    this.bumpMutation();
  }

  pushUndo() {
    this.history.push(this.snapshotWidgets());
  }

  undo() {
    this.restore(this.history.undo(this.snapshotWidgets()));
  }

  redo() {
    this.restore(this.history.redo(this.snapshotWidgets()));
  }

  private restore(widgets: WidgetDefaultConfig[] | null) {
    if (widgets === null) return;

    this.setWidgets(widgets);
    this.commitActiveLayout();
    this.bumpMutation();
  }

  bringToFront(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    widget.userSettings.zIndex = topZIndex(this.allWidgets, id) + 1;
    this.bumpMutation();
  }

  sendToBack(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    widget.userSettings.zIndex = bottomZIndex(this.allWidgets, id) - 1;
    this.bumpMutation();
  }

  private bumpMutation() {
    this.changeToken++;
  }

  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((defaultWidget) => {
        const savedWidget = widgets.find(
          (widget) => widget.id === defaultWidget.id
        );

        const mergedUserSettings = savedWidget
          ? mergeWithDefaults(
              defaultWidget.userSettings,
              savedWidget.userSettings ?? {}
            )
          : { ...defaultWidget.userSettings };

        const existing = this.widgets.get(defaultWidget.id);

        if (existing) {
          Object.assign(existing.userSettings, mergedUserSettings);

          if (savedWidget) {
            const merged = mergeWithDefaults(defaultWidget, savedWidget);
            existing.designWidth = merged.designWidth;
            existing.designHeight = merged.designHeight;
          }

          applyDerivedDesignWidth(defaultWidget.id, existing);
        } else {
          const installed = savedWidget
            ? {
                ...mergeWithDefaults(defaultWidget, savedWidget),
                userSettings: mergedUserSettings,
              }
            : { ...defaultWidget, userSettings: mergedUserSettings };

          applyDerivedDesignWidth(defaultWidget.id, installed);

          this.widgets.set(defaultWidget.id, installed);
        }
      });

      this.bumpMutation();

      const fuel = this.widgets.get('fuel');

      if (fuel) {
        const settings = fuel.userSettings as unknown as FuelWidgetSettings;

        setPitWarningLapsSilent(settings.pitWarningLaps);
        setFuelAvgWindowSilent(settings.fuelAvgWindow);
      }
    });
  }

  applySettingsSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (!existing) continue;

        Object.assign(existing.userSettings, incoming.userSettings);
        existing.designWidth = deriveWidgetDesignWidth(
          incoming.id,
          existing.userSettings,
          incoming.designWidth
        );
        existing.designHeight = incoming.designHeight;
      }

      this.syncToken++;
    });
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    return this.widgets.get(id);
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.pushUndo();
    this.updateUserSettings(id, { enabled });
  }

  /**
   * Widgets the F9 picker can drop onto a screen: everything the overlay window
   * isn't already drawing there. A widget that is enabled but lives on another
   * monitor is kept in the list with that monitor's name, so the picker offers
   * to move it instead of pretending a second copy could exist.
   */
  pickableWidgetsForMonitor(monitorName: string): PickableWidget[] {
    return pickableWidgetsForMonitor(
      this.allWidgets,
      this.enabledWidgets,
      this.availableWidgetIds,
      monitorName,
      this.activeLayout?.monitors ?? []
    );
  }

  /**
   * Enables a widget and drops it in the middle of the given monitor, on top of
   * whatever is already there. Placement is not cosmetic: an overlay window
   * only speaks for the widgets whose centre lands on its own screen, so a
   * widget left at its stale coordinates would be enabled in the overlay and
   * then dropped by the main window's sync.
   */
  addWidgetToMonitor(id: string, monitorName: string) {
    const widget = this.getWidget(id);
    const monitor = this.monitorByName(monitorName);

    if (!widget || !monitor) return;

    this.pushUndo();

    const occupied = widgetsOnMonitor(
      this.enabledWidgets,
      monitorName,
      this.activeLayout?.monitors ?? []
    ).filter((placed) => placed.id !== id);

    const spot = spotForAddedWidget(widget, monitor, occupied, this.allWidgets);

    widget.userSettings.x = spot.x;
    widget.userSettings.y = spot.y;
    widget.userSettings.zIndex = spot.zIndex;
    widget.userSettings.enabled = true;

    this.bumpMutation();
  }

  updatePosition(id: string, x: number, y: number) {
    const widget = this.getWidget(id);

    if (
      widget &&
      (widget.userSettings.x !== x || widget.userSettings.y !== y)
    ) {
      widget.userSettings.x = x;
      widget.userSettings.y = y;

      this.bumpMutation();
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.getWidget(id);

    if (
      widget &&
      (widget.userSettings.currentWidth !== width ||
        widget.userSettings.currentHeight !== height)
    ) {
      widget.userSettings.currentWidth = width;
      widget.userSettings.currentHeight = height;

      this.bumpMutation();
    }
  }

  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.getWidget(id);

    if (!widget) return;

    let resolvedPartial = partial;

    if (
      id === 'fuel' &&
      'barWidth' in partial &&
      partial.barWidth !== undefined
    ) {
      resolvedPartial = {
        ...partial,
        barWidth: Math.max(5, Math.min(20, partial.barWidth)),
      };
    }

    const prevSettings = { ...widget.userSettings };

    Object.assign(widget.userSettings, resolvedPartial);

    applyLayoutResize(id, widget, prevSettings, widget.userSettings);

    this.bumpMutation();

    if (id === 'fuel' && 'pitWarningLaps' in resolvedPartial) {
      setPitWarningLapsSilent(
        (resolvedPartial as FuelWidgetSettings).pitWarningLaps
      );
    }

    if (id === 'fuel' && 'fuelAvgWindow' in resolvedPartial) {
      setFuelAvgWindowSilent(
        (resolvedPartial as FuelWidgetSettings).fuelAvgWindow
      );
    }
  }

  setOverlayResolution(resolution: LayoutResolution) {
    this.overlayResolution = { ...resolution };
  }

  setAttachedMonitors(monitors: LayoutMonitor[]) {
    this.attachedMonitors = monitors;
  }

  setOwnMonitorName(monitorName: string) {
    this.ownMonitorName = monitorName;
  }

  // Overlay side: adopt the monitor arrangement the main window just sent.
  applyMonitorsSync(monitors: LayoutMonitor[]) {
    const layout = this.activeLayout;

    if (!layout) return;

    layout.monitors = monitors.map(cloneMonitor);
  }

  loadActiveLayoutWidgets() {
    const layout = this.activeLayout;

    if (!layout) return;

    this.setWidgets(layout.widgets);
  }

  // Widgets drawn by this overlay window: the ones whose centre falls on its
  // monitor. Dragging a widget over an edge hands it to the neighbour.
  get ownMonitorWidgets(): WidgetDefaultConfig[] {
    const monitorName = this.ownMonitorName;
    const monitors = this.activeLayout?.monitors ?? [];

    if (!monitorName || monitors.length === 0) return [];

    return widgetsOnMonitor(this.enabledWidgets, monitorName, monitors);
  }

  get enabledWidgets(): WidgetDefaultConfig[] {
    return this.allWidgets.filter((widget) => widget.userSettings.enabled);
  }

  // Monitors of the active layout that actually have something to draw. A
  // full-screen transparent always-on-top window costs DWM composition over the
  // game and a copy of every telemetry bundle, so empty screens get none.
  get populatedMonitorNames(): string[] {
    const monitors = this.activeLayout?.monitors ?? [];
    const enabled = this.enabledWidgets;

    return monitors
      .filter(
        (monitor) =>
          isDisplayMonitor(monitor) &&
          widgetsOnMonitor(enabled, monitor.name, monitors).length > 0
      )
      .map((monitor) => monitor.name);
  }

  // Applies widgets synced in from an overlay window. Only the widgets that
  // window owns are taken: it knows nothing about the other monitors, and its
  // copy of them would be stale.
  applySettingsSyncForMonitor(
    monitorName: string,
    widgets: WidgetDefaultConfig[]
  ) {
    const layout = this.activeLayout;

    if (!layout) return;

    const owned = new Set(
      widgetsOnMonitor(widgets, monitorName, layout.monitors).map(
        (widget) => widget.id
      )
    );

    for (const widget of widgets) {
      if (!owned.has(widget.id)) continue;

      const live = this.widgets.get(widget.id);

      if (live) {
        Object.assign(live.userSettings, widget.userSettings);

        // Derived from the settings just applied, never from the incoming copy:
        // the overlay knows only its own monitor, so its stored width can be
        // stale even when the settings it sends are not.
        live.designWidth = deriveWidgetDesignWidth(
          widget.id,
          live.userSettings,
          live.designWidth
        );
      }
    }

    this.syncToken++;
  }

  // Explicit "move to monitor" action. Dragging across an edge in the editor
  // needs no conversion — coordinates are already desktop-wide — but a widget
  // on an unplugged screen can only be recovered this way.
  moveWidgetToMonitor(widgetId: string, targetMonitorName: string) {
    const layout = this.activeLayout;
    const widget = this.widgets.get(widgetId);

    if (!layout || !widget) return;

    const from = monitorForWidget(widget, layout.monitors);
    const to = layout.monitors.find(
      (monitor) => monitor.name === targetMonitorName
    );

    if (!from || !to || from.name === to.name) return;

    const moved = placeWidgetOnMonitor(widget, from.bounds, to.bounds);

    widget.userSettings.x = moved.userSettings.x;
    widget.userSettings.y = moved.userSettings.y;
    this.bumpMutation();
  }

  private snapshotWidgets(): WidgetDefaultConfig[] {
    // Spread into plain object literals so each layout owns a detached copy of
    // the live widgets. (structuredClone throws on MobX observable proxies.)
    return this.allWidgets.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));
  }

  setLayouts(layouts: SavedLayout[], activeLayoutId?: string | null) {
    this.layoutRecords.setLayouts(layouts, activeLayoutId);

    const activeLayout = this.layoutRecords.activeLayout;

    if (activeLayout) {
      this.setWidgets(activeLayout.widgets);
    }
  }

  // Guarantees there is always an active layout. Creates a "Default" layout on
  // first run, anchored to the primary monitor — a layout with no monitor gets
  // no overlay window and no area to place widgets on.
  ensureDefaultLayout() {
    const id = this.layoutRecords.createDefaultLayout();

    if (!id) return;

    void resolveMonitorByName(null).then((monitor) => {
      if (!monitor) return;

      runInAction(() => {
        const target = this.layoutRecords.byId(id);

        if (!target || target.monitors.length > 0) return;

        this.overlayResolution = { ...monitor.resolution };

        this.layoutRecords.setMonitors(id, [
          {
            name: monitor.name,
            bounds: {
              x: 0,
              y: 0,
              width: monitor.resolution.width,
              height: monitor.resolution.height,
            },
          },
        ]);
        target.widgets = this.buildStarterWidgets();

        this.setWidgets(target.widgets);
        this.bumpMutation();
      });
    });
  }

  private buildStarterWidgets(clean: boolean = false): WidgetDefaultConfig[] {
    return buildStarterWidgets(
      this.root?.widgetDefaults.snapshot() ?? [],
      this.overlayResolution,
      clean
    );
  }

  saveLayout(name: string) {
    const id = this.layoutRecords.addLayout(name);

    this.layoutRecords.setActiveLayoutId(id);
    this.setWidgets(this.buildStarterWidgets(true));
    this.bumpMutation();

    void resolveMonitorByName(null).then((monitor) => {
      if (!monitor) return;

      runInAction(() => {
        const targetLayout = this.layoutRecords.byId(id);

        if (!targetLayout || targetLayout.monitors.length > 0) return;

        this.layoutRecords.setMonitors(id, [
          {
            name: monitor.name,
            bounds: {
              x: 0,
              y: 0,
              width: monitor.resolution.width,
              height: monitor.resolution.height,
            },
          },
        ]);
        targetLayout.widgets = this.buildStarterWidgets(true);

        if (this.layoutRecords.activeLayoutId === id) {
          this.overlayResolution = { ...monitor.resolution };
        }

        this.bumpMutation();
      });
    });
  }

  get activeLayout(): SavedLayout | undefined {
    return this.layoutRecords.activeLayout;
  }

  // Selecting a layout loads its saved widgets into the live store. Repointing
  // activeLayoutId alone would let the commit reaction clobber the selected
  // layout with the previously-active layout's stale widgets.
  selectLayout(id: string | null) {
    if (id) {
      this.loadLayout(id);

      return;
    }

    this.layoutRecords.setActiveLayoutId(null);
    this.bumpMutation();
  }

  // Load a layout into the editor without pushing it to the overlay.
  // The overlay keeps showing whatever was active before. Use activateEditorLayout()
  // or loadLayout() to make the overlay reflect the change.
  switchEditorLayout(id: string) {
    const layout = this.layoutRecords.byId(id);

    if (!layout) return;

    // Entering preview replaces the live widget map with the previewed layout's
    // while the overlay keeps rendering the old one, so remember what is
    // actually on screen — runtime gating has to follow the overlay, not the
    // editor. Re-entering preview from preview must not overwrite it.
    if (!this.editorPreviewMode) {
      this.liveEnabledWidgetIds = this.enabledWidgetIds;
    }

    this.editorPreviewMode = true;
    this.layoutRecords.setActiveLayoutId(id);

    this.setWidgets(layout.widgets);

    this.bumpMutation();
  }

  // Make the layout currently shown in the editor the active one in the overlay.
  activateEditorLayout() {
    this.editorPreviewMode = false;
    this.liveEnabledWidgetIds = null;
    this.bumpMutation();
  }

  loadLayout(id: string, options?: { notify?: boolean }) {
    const layout = this.layoutRecords.byId(id);

    if (!layout) return;

    this.editorPreviewMode = false;
    this.liveEnabledWidgetIds = null;
    this.layoutRecords.setActiveLayoutId(id);

    if (layout.monitors.length > 0) {
      this.setWidgets(layout.widgets);
    } else {
      // No monitor config yet (e.g. a brand-new layout whose auto-resolve
      // hasn't landed). Fall back to a blank layout instead of silently
      // leaving the previously-active layout's widgets on screen.
      this.setWidgets(this.buildStarterWidgets(true));
    }

    this.bumpMutation();

    if (options?.notify) {
      void emitLayoutActivated(layout.name);
    }
  }

  // Auto-commit: writes the live widgets back into the active layout. Skipped
  // for a layout with no monitors — it has no area to hold them yet.
  commitActiveLayout() {
    const layout = this.activeLayout;

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = this.snapshotWidgets();
  }

  updateLayout(id: string) {
    const layout = this.layoutRecords.byId(id);

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = this.snapshotWidgets();
    this.bumpMutation();
  }

  deleteLayout(id: string) {
    const wasActive = this.layoutRecords.activeLayoutId === id;

    this.layoutRecords.removeLayout(id);

    if (!wasActive) {
      this.bumpMutation();

      return;
    }

    const fallbackId = this.layoutRecords.layouts[0]?.id ?? null;

    // Load the fallback's saved widgets into the live store BEFORE bumping the
    // mutation so the commit reaction doesn't clobber the fallback.
    if (fallbackId) {
      this.loadLayout(fallbackId);

      return;
    }

    this.layoutRecords.setActiveLayoutId(null);
    this.bumpMutation();
  }

  renameLayout(id: string, name: string) {
    this.layoutRecords.renameLayout(id, name);
    this.bumpMutation();
  }

  /**
   * Layout-record mutations all funnel through here rather than being called on
   * `layoutRecords` directly: `bumpMutation` is what triggers the debounced save,
   * so a record edited behind the facade's back would never reach disk.
   */
  addMonitor(monitor: LayoutMonitor) {
    this.layoutRecords.addMonitor(monitor);
    this.bumpMutation();
  }

  /**
   * Adds a device screen to the active layout. It is a monitor in every way
   * that matters for the layout — widgets belong to it by their centre point,
   * it gets its own widget set — but the machine has no display behind it, so
   * it is parked in free desktop space and never gets an overlay window.
   */
  addRemoteScreen(name: string, width: number, height: number) {
    const layout = this.activeLayout;

    if (!layout) return;

    const slug = uniqueSlug(
      slugFromName(name),
      layout.monitors.map((monitor) => monitor.slug ?? '')
    );

    this.layoutRecords.addMonitor({
      name,
      kind: 'remote',
      slug,
      bounds: nextRemoteBounds(layout.monitors, width, height),
    });

    this.bumpMutation();
  }

  /** Applied when a device reports a viewport that differs from the size the
   *  screen was drawn for. Never automatic: resizing moves every widget. */
  resizeRemoteScreen(monitorName: string, width: number, height: number) {
    const layout = this.activeLayout;
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
      this.allWidgets,
      monitorName,
      layout.monitors
    );

    monitor.bounds = landed;

    const dx = landed.x - grown.x;
    const dy = landed.y - grown.y;

    for (const widget of carried) {
      widget.userSettings.x += dx;
      widget.userSettings.y += dy;
    }

    this.commitActiveLayout();
    this.bumpMutation();
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
    const layout = this.activeLayout;

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
      this.allWidgets,
      monitorName,
      layout.monitors
    );

    monitor.bounds = target;

    for (const widget of carried) {
      widget.userSettings.x += dx;
      widget.userSettings.y += dy;
    }

    this.commitActiveLayout();
    this.bumpMutation();
  }

  /**
   * Re-parks every remote screen in rows under the real desktop. New screens
   * are appended to the right of everything else, which turns a handful of them
   * into a strip too wide for the editor to show at a useful scale.
   */
  arrangeRemoteScreens() {
    const layout = this.activeLayout;

    if (!layout) return;

    const targets = remoteScreenGrid(layout.monitors);

    // Ownership is read against the arrangement as it stands, before any
    // rectangle moves — halfway through, a widget's centre could fall inside a
    // screen that has already been re-parked.
    const carried = new Map(
      Object.keys(targets).map((name) => [
        name,
        widgetsOnMonitor(this.allWidgets, name, layout.monitors),
      ])
    );

    for (const monitor of layout.monitors) {
      const target = targets[monitor.name];

      if (!target) continue;

      const dx = target.x - monitor.bounds.x;
      const dy = target.y - monitor.bounds.y;

      monitor.bounds = target;

      for (const widget of carried.get(monitor.name) ?? []) {
        widget.userSettings.x += dx;
        widget.userSettings.y += dy;
      }
    }

    this.commitActiveLayout();
    this.bumpMutation();
  }

  removeMonitor(layoutId: string, monitorName: string) {
    const layout = this.layoutRecords.removeMonitor(layoutId, monitorName);

    if (!layout) return;

    if (layout.id === this.layoutRecords.activeLayoutId) {
      this.setWidgets(layout.widgets);
    }

    this.bumpMutation();
  }

  setMonitorBackground(monitorName: string, image: string | undefined) {
    this.layoutRecords.setMonitorBackground(monitorName, image);
    this.bumpMutation();
  }

  setActiveLayoutBackground(image: string | undefined) {
    this.layoutRecords.setActiveLayoutBackground(image);
    this.bumpMutation();
  }

  async cloneLayout(id: string) {
    const newId = await this.layoutRecords.cloneLayout(id);

    runInAction(() => this.bumpMutation());

    return newId;
  }

  /** Records plus the live widgets they moved — see `LayoutsStore` for the maths. */
  alignMonitorsToHardware(attached: LayoutMonitor[]) {
    this.layoutRecords.alignMonitorsToHardware(attached);

    const activeLayout = this.layoutRecords.activeLayout;

    if (activeLayout) {
      this.setWidgets(activeLayout.widgets);
    }

    this.bumpMutation();
  }

  monitorByName(monitorName: string): LayoutMonitor | undefined {
    return this.layoutRecords.monitorByName(monitorName);
  }

  get desktopBounds() {
    return this.layoutRecords.desktopBounds;
  }

  get activeMonitorNames(): string[] {
    return this.layoutRecords.activeMonitorNames;
  }

  get layouts(): SavedLayout[] {
    return this.layoutRecords.layouts;
  }

  get activeLayoutId(): string | null {
    return this.layoutRecords.activeLayoutId;
  }

  get sessionLayouts(): Record<SessionContext, string | null> {
    return this.layoutRecords.sessionLayouts;
  }

  getSettings<SpecificSettings extends WidgetSpecificSettings>(
    widgetId: string
  ): BaseUserSettings & SpecificSettings {
    const widget = this.getWidget(widgetId);

    const defaultConfig = DEFAULT_WIDGETS.find(
      (defaultWidget) => defaultWidget.id === widgetId
    );
    const defaultSettings = defaultConfig?.userSettings as
      | (BaseUserSettings & SpecificSettings)
      | undefined;

    return (
      (widget?.userSettings as unknown as BaseUserSettings &
        SpecificSettings) ?? defaultSettings
    );
  }
}

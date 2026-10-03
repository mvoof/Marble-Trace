import { makeAutoObservable, runInAction } from 'mobx';
import { mergeWithDefaults } from '@store/deep-merge';
import { DEFAULT_WIDGETS, DEFAULT_WIDGET_BY_ID } from '@store/widget-catalog';
import { nextInstanceId, widgetTypeFromId } from '@utils/widget-instance';
import {
  setFuelAvgWindowSilent,
  setFuelCountYellowLapsSilent,
  setPitWarningLapsSilent,
} from '@platform/services/settings.service';
import type { LayoutsStore } from '@store/settings/layouts.store';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
import { availableWidgetIdsOf } from '@store/settings/widget-availability';
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
  DeltaWidgetSettings,
  LapDeltaReference,
  WidgetSpecificSettings,
  WidgetUserSettings,
} from '@/types/widget-settings';
import { DEFAULT_LAYOUT_RESOLUTION } from '@store/settings/layout-resolution';
import {
  clampToBounds,
  monitorForWidget,
  placeWidgetOnMonitor,
  primaryMonitorOf,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';
import { cloneMonitor, isDisplayMonitor } from '@utils/remote-screen';
import { WidgetHistory } from '@store/settings/widget-history';
import {
  bottomZIndex,
  buildStarterWidgets,
  pickableWidgetsForMonitor,
  spotForAddedWidget,
  topZIndex,
  type PickableWidget,
} from '@store/settings/widget-placement';
import type { WidgetMap } from '@store/settings/widget-map';
import type { WidgetDefaultsStore } from '@store/settings/widget-defaults.store';
import type { CapabilitiesPayload } from '@/types/bindings';

const LAYOUT_TOAST_DURATION_MS = 3000;

// How far a duplicate lands from the widget it was copied from, so the two
// are visibly separate the moment the copy appears.
const DUPLICATE_OFFSET_PX = 24;

export type { PickableWidget };

export class LiveWidgetsStore implements WidgetMap {
  /**
   * Widgets of the active layout, keyed by id.
   *
   * A *projection*, not a copy: the objects are the active layout's own, so
   * every edit the overlay or the editor makes lands in the layout record
   * itself. There is nothing to commit afterwards and nothing that can drift
   * out of step with it — the layout is the single owner of a widget's state.
   */
  get widgets(): Map<string, WidgetDefaultConfig> {
    const layout = this.widgetOwner;

    if (!layout) {
      return this.detachedWidgets;
    }

    return new Map(layout.widgets.map((widget) => [widget.id, widget]));
  }

  /**
   * The layout an edit belongs to, or null when there is nowhere to put one.
   *
   * A layout with no monitors is not an owner: it has no area to place a widget
   * on, and the widgets it already holds are the ones it had when its last
   * screen was removed. Writing to it would replace a saved arrangement with
   * the blank starter set the window falls back to meanwhile.
   */
  private get widgetOwner(): SavedLayout | null {
    const layout = this.layoutRecords.editingLayout;

    return layout && layout.monitors.length > 0 ? layout : null;
  }

  /**
   * Stand-in for the window that has no active layout yet: the settings file is
   * still loading, the config is locked, or every layout has just been deleted.
   * Holding the shipped defaults here keeps `widgets` a total function, so no
   * caller has to guard against a layout that has not arrived.
   */
  private detachedWidgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  readonly history = new WidgetHistory();

  /**
   * The saved layout records, handed in rather than created here: both stores
   * write into the same `SettingsMutationLog`, and that shared log — not shared
   * construction — is what keeps them in step. Held privately: the records are
   * reached from outside as `root.layouts`, and this store offers no second
   * path to them. Everything below that reads or writes a layout goes through
   * it — this store keeps only the live working copy the overlay renders.
   */
  private readonly layoutRecords: LayoutsStore;

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

  /**
   * Overlay side: the layout id of the last widget list main pushed here. It
   * travels back on every echo so main can tell whether the window is still
   * speaking for the layout that is active now — an echo in flight across a
   * layout switch otherwise lands in the wrong layout record.
   */
  syncedLayoutId: string | null = null;

  // Name shown in the overlay's "layout switched" toast; null once it expires.
  layoutActivatedToast: string | null = null;

  private layoutToastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly mutations: SettingsMutationLog,
    layoutRecords: LayoutsStore,
    private readonly widgetDefaults: WidgetDefaultsStore,
    /**
     * The sim's capabilities, read through a getter rather than held: the sim
     * store is built after this one, and what it reports changes with every
     * connection. Undefined until a sim has answered, which reads as "hide
     * nothing".
     */
    private readonly capabilitiesOf: () => CapabilitiesPayload | null
  ) {
    this.layoutRecords = layoutRecords;

    makeAutoObservable<
      LiveWidgetsStore,
      'layoutToastTimer' | 'mutations' | 'capabilitiesOf'
    >(
      this,
      {
        layoutToastTimer: false,
        mutations: false,
        capabilitiesOf: false,
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

  /**
   * The widgets the overlay is rendering right now.
   *
   * The same list as `allWidgets` whenever the editor is closed. While it is
   * open the two diverge, and everything that speaks for the screen — the push
   * to the overlay windows, the remote snapshot, the telemetry mask, whether a
   * widget's hotkeys are live — reads this one. `allWidgets` stays what the
   * editor is working on.
   */
  get liveWidgets(): WidgetDefaultConfig[] {
    void this.mutations.changeToken;

    const layout = this.layoutRecords.liveLayout;

    if (!layout || layout.monitors.length === 0) {
      return this.allWidgets;
    }

    return layout.widgets;
  }

  get liveEnabledWidgetIds(): string[] {
    const available = new Set(
      availableWidgetIdsOf(this.liveWidgets, this.capabilitiesOf())
    );

    return this.liveWidgets
      .filter(
        (widget) => widget.userSettings.enabled && available.has(widget.id)
      )
      .map((widget) => widget.id);
  }

  get availableWidgetIds(): string[] {
    return availableWidgetIdsOf(this.widgets.values(), this.capabilitiesOf());
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
  isWidgetOnScreen(widgetType: string): boolean {
    const live = new Set(this.liveEnabledWidgetIds);

    // Addressed by type, not by copy: a binding belongs to the widget, so it
    // fires while any copy of it is on screen. Which copies it then reaches is
    // the action's own business.
    return this.liveWidgets.some(
      (widget) => live.has(widget.id) && widget.type === widgetType
    );
  }

  cycleStandingsViewMode() {
    const order: StandingsViewMode[] = ['all', 'grouped', 'cycling'];

    // Every copy, each advanced from where it stands: a hotkey means the widget,
    // and a copy left behind on a stream screen showing a mode nobody chose is
    // worse than all of them moving together.
    for (const widget of this.widgetsOfType('standings')) {
      const settings = this.getSettings<StandingsWidgetSettings>(widget.id);
      const nextIdx = (order.indexOf(settings.viewMode) + 1) % order.length;

      this.updateUserSettings(widget.id, { viewMode: order[nextIdx] });
    }
  }

  cycleDeltaReference() {
    const order: LapDeltaReference[] = [
      'personal_best',
      'personal_optimal',
      'session_best',
      'session_optimal',
      'session_last',
    ];

    // Every copy, each advanced from where it stands — same reasoning as the
    // standings view mode above.
    for (const widget of this.widgetsOfType('delta')) {
      const settings = this.getSettings<DeltaWidgetSettings>(widget.id);
      const nextIdx = (order.indexOf(settings.reference) + 1) % order.length;

      this.updateUserSettings(widget.id, { reference: order[nextIdx] });
    }
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
    this.bumpMutation();
  }

  bringToFront(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    widget.userSettings.zIndex = topZIndex(this.allWidgets, id) + 1;
    this.bumpMutation(id);
  }

  sendToBack(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    widget.userSettings.zIndex = bottomZIndex(this.allWidgets, id) - 1;
    this.bumpMutation(id);
  }

  /**
   * Widgets mutated locally since the last drain, and the flag that says the
   * whole map was replaced instead. The overlay reports its edits to main as a
   * patch of exactly these widgets — a full list is both wasteful and unsafe,
   * since a window's copy of the other screens is stale by construction.
   */
  private bumpMutation(widgetId?: string) {
    if (widgetId === undefined) {
      this.mutations.recordEveryWidget();
    } else {
      this.mutations.recordWidget(widgetId);
    }
  }

  /**
   * Takes the widgets edited here since the last call and forgets them.
   * `everyWidget` means the map was installed wholesale (a layout load, an
   * undo) and only a full list describes it.
   */
  drainTouchedWidgets(): {
    everyWidget: boolean;
    widgets: WidgetDefaultConfig[];
  } {
    const { everyWidget, widgetIds } = this.mutations.drain();

    if (everyWidget) {
      return { everyWidget, widgets: this.allWidgets };
    }

    return {
      everyWidget,
      widgets: widgetIds
        .map((id) => this.widgets.get(id))
        .filter(
          (widget): widget is WidgetDefaultConfig => widget !== undefined
        ),
    };
  }

  /**
   * Brings a widget list up to the current shape and installs it as the
   * active layout's widgets: stored settings are merged over the shipped
   * defaults, a design width that is derived rather than stored is recomputed,
   * and every widget is given a monitor of this layout to belong to.
   *
   * A widget the list holds no instance of at all is added, switched off, on
   * the primary monitor: every widget the build ships has at least one record
   * in a layout, so there is always one to switch on.
   *
   * Normalizing here rather than on read is what lets `widgets` be a plain
   * projection: a widget is repaired once, when the layout is installed, and
   * the repair is written to the record everything else reads.
   */
  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      const layout = this.widgetOwner;
      const primary = layout ? primaryMonitorOf(layout) : undefined;

      const normalized = DEFAULT_WIDGETS.flatMap((defaultWidget) => {
        // Every instance of this widget the list holds, in the order it held
        // them. Walking the catalog rather than the list is what keeps the
        // shipped order stable and groups a widget's instances together; a
        // record whose type this build no longer ships is visited by nothing
        // here and so drops out.
        const savedInstances = widgets.filter(
          (widget) => widget.type === defaultWidget.id
        );

        if (savedInstances.length === 0) {
          const installed: WidgetDefaultConfig = {
            ...defaultWidget,
            userSettings: { ...defaultWidget.userSettings, enabled: false },
          };

          applyDerivedDesignWidth(defaultWidget.id, installed);

          return [this.ownedBy(installed, layout, primary)];
        }

        return savedInstances.map((savedWidget) => {
          const installed: WidgetDefaultConfig = {
            ...mergeWithDefaults(defaultWidget, savedWidget),
            // Taken from the record, not from the default: `id` is the
            // instance's own key and `monitor` is where it stands, and taking
            // either from the manifest would collapse every instance into one.
            id: savedWidget.id,
            type: defaultWidget.id,
            ...(savedWidget.monitor === undefined
              ? {}
              : { monitor: savedWidget.monitor }),
            userSettings: mergeWithDefaults(
              defaultWidget.userSettings,
              savedWidget.userSettings ?? {}
            ),
          };

          applyDerivedDesignWidth(defaultWidget.id, installed);

          return this.ownedBy(installed, layout, primary);
        });
      });

      if (layout) {
        layout.widgets = normalized;
      } else {
        this.detachedWidgets = new Map(
          normalized.map((widget) => [widget.id, widget])
        );
      }

      this.bumpMutation();

      // The backend keeps one copy of these, so one instance has to speak for
      // them however many the layout holds.
      const fuel = this.primaryInstanceOf('fuel');

      if (fuel) {
        const settings = fuel.userSettings as unknown as FuelWidgetSettings;

        setPitWarningLapsSilent(settings.pitWarningLaps);
        setFuelAvgWindowSilent(settings.fuelAvgWindow);
        setFuelCountYellowLapsSilent(settings.countYellowFlagLaps);
      }
    });
  }

  /**
   * Gives a widget that stands on no monitor of this layout the primary one,
   * and moves it inside that monitor — a widget is drawn only by its own
   * monitor's window, and one left at stale coordinates would be invisible.
   * A widget that already names a monitor of the layout is left exactly where
   * it is.
   */
  private ownedBy(
    widget: WidgetDefaultConfig,
    layout: SavedLayout | null,
    primary: LayoutMonitor | undefined
  ): WidgetDefaultConfig {
    if (!layout || !primary) return widget;

    if (monitorForWidget(widget, layout.monitors)) return widget;

    const { x, y } = clampToBounds(primary.bounds, widget.userSettings, {
      width: widget.userSettings.currentWidth,
      height: widget.userSettings.currentHeight,
    });

    widget.monitor = primary.name;
    widget.userSettings.x = x;
    widget.userSettings.y = y;

    return widget;
  }

  /**
   * Installs a widget list a window received from elsewhere.
   *
   * `applySettingsSync` patches records it already holds and can express
   * neither an instance that appeared nor one that was deleted.
   *
   * So this adopts the list: a widget already here is patched, one that is new
   * is installed beside it, one the list no longer names is dropped. What it
   * deliberately does *not* do is run the list through `setWidgets`: that fills
   * a widget the list left out with its shipped default, which is right for a
   * layout being loaded and catastrophic for a list arriving over an event —
   * the receiver would answer with a default-placed widget, and the window that
   * sent it would take that answer for an edit.
   *
   * A sync, like `applySettingsSync`, moves `syncToken` and not `changeToken`:
   * a window that was told something has nothing to report back.
   */
  syncWidgetSet(widgets: WidgetDefaultConfig[]) {
    const known = this.widgets;

    // The set is what this is for, and the set almost never changes: a drag
    // syncs on every mouse move, and rebuilding the collection each time
    // rerenders every widget's content — canvases and all — while the user is
    // only moving one of them. Same ids, same order: patch in place.
    const isUnchanged =
      known.size === widgets.length &&
      widgets.every((widget) => known.has(widget.id));

    if (isUnchanged) {
      this.applySettingsSync(widgets);

      return;
    }

    runInAction(() => {
      const adopted = widgets.map((incoming) => {
        const existing = known.get(incoming.id);

        if (!existing) {
          const installed: WidgetDefaultConfig = {
            ...incoming,
            userSettings: { ...incoming.userSettings },
          };

          applyDerivedDesignWidth(incoming.type, installed);

          return installed;
        }

        this.patchFromSync(existing, incoming);

        return existing;
      });

      const layout = this.widgetOwner;

      if (layout) {
        layout.widgets = adopted;
      } else {
        this.detachedWidgets = new Map(
          adopted.map((widget) => [widget.id, widget])
        );
      }

      this.mutations.recordSynced();
    });
  }

  applySettingsSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (!existing) continue;

        this.patchFromSync(existing, incoming);
      }

      this.mutations.recordSynced();
    });
  }

  /**
   * Writes a synced copy of a widget onto the record held here. The monitor
   * travels with it: "move to monitor" in one window changes nothing but the
   * monitor and the position, and the other window has to follow both.
   */
  private patchFromSync(
    existing: WidgetDefaultConfig,
    incoming: WidgetDefaultConfig
  ) {
    Object.assign(existing.userSettings, incoming.userSettings);

    if (incoming.monitor !== undefined) {
      existing.monitor = incoming.monitor;
    }

    existing.designWidth = deriveWidgetDesignWidth(
      incoming.type,
      existing.userSettings,
      incoming.designWidth
    );
    existing.designHeight = incoming.designHeight;
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    void this.mutations.syncToken;
    void this.mutations.changeToken;
    return this.widgets.get(id);
  }

  /**
   * Every instance of one widget in this layout, on every monitor, in catalog
   * order.
   *
   * The counterpart to `getWidget`, which addresses a single instance: this
   * addresses the widget itself, for the callers that mean "wherever this is on
   * screen" — a hotkey, the telemetry mask, the layout gate.
   */
  widgetsOfType(type: string): WidgetDefaultConfig[] {
    void this.mutations.syncToken;
    void this.mutations.changeToken;

    return this.allWidgets.filter((widget) => widget.type === type);
  }

  /**
   * The instance that speaks for a widget where only one answer is possible: a
   * setting the backend keeps once, or a widget store, which is one per app and
   * so cannot be per instance.
   *
   * The one the driver is looking at wins — switched on, on the layout's
   * primary monitor — then any switched-on instance, then any instance on the
   * primary monitor, then the first.
   */
  primaryInstanceOf(type: string): WidgetDefaultConfig | undefined {
    const instances = this.widgetsOfType(type);
    const layout = this.widgetOwner;
    const primaryName = layout ? primaryMonitorOf(layout)?.name : undefined;
    const isOnPrimary = (widget: WidgetDefaultConfig) =>
      primaryName !== undefined && widget.monitor === primaryName;

    return (
      instances.find(
        (widget) => widget.userSettings.enabled && isOnPrimary(widget)
      ) ??
      instances.find((widget) => widget.userSettings.enabled) ??
      instances.find(isOnPrimary) ??
      instances[0]
    );
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.pushUndo();
    this.updateUserSettings(id, { enabled });
  }

  /**
   * Makes another instance of a widget, on the same monitor, and returns its
   * id.
   *
   * The new instance carries the source's settings as its starting point and
   * then owns them: changing its columns, its scale or its enabled flag leaves
   * the source alone. It is offset slightly so it does not land exactly under
   * the widget it came from, and lifted to the top so it is the one being
   * dragged.
   *
   * Placed straight into the layout record rather than through `setWidgets`,
   * which normalizes a whole list — there is nothing to repair in a record
   * copied from one that was normalized when the layout was installed.
   */
  duplicateWidget(id: string): string | null {
    const source = this.getWidget(id);

    if (!source) return null;

    const layout = this.widgetOwner;

    if (!layout) return null;

    this.pushUndo();

    const offset = {
      x: source.userSettings.x + DUPLICATE_OFFSET_PX,
      y: source.userSettings.y + DUPLICATE_OFFSET_PX,
    };
    const monitor = monitorForWidget(source, layout.monitors);
    const position = monitor
      ? clampToBounds(monitor.bounds, offset, {
          width: source.userSettings.currentWidth,
          height: source.userSettings.currentHeight,
        })
      : offset;

    const copy: WidgetDefaultConfig = {
      ...source,
      id: nextInstanceId(source.type, this.widgets.keys()),
      userSettings: {
        ...source.userSettings,
        x: position.x,
        y: position.y,
        zIndex: topZIndex(this.allWidgets, id) + 1,
      },
    };

    // Right after the widget it came from, so a widget's copies stay together
    // in the list and in settings.json.
    layout.widgets.splice(
      layout.widgets.findIndex((widget) => widget.id === id) + 1,
      0,
      copy
    );

    this.bumpMutation();

    return copy.id;
  }

  /**
   * Removes an instance from the layout for good — any instance, as long as
   * another one of the same widget stays in the layout. The last one can only
   * be switched off: there would be nothing left to switch on again, and
   * `setWidgets` would put one back on the next load anyway.
   */
  removeWidgetCopy(id: string) {
    const widget = this.getWidget(id);

    if (!widget || !this.canRemoveWidget(id)) return;

    const layout = this.widgetOwner;

    if (!layout) return;

    this.pushUndo();

    layout.widgets = layout.widgets.filter((entry) => entry.id !== id);
    this.bumpMutation();
  }

  /** Whether `removeWidgetCopy` would take this instance out of the layout. */
  canRemoveWidget(id: string): boolean {
    const widget = this.getWidget(id);

    if (!widget) return false;

    return this.widgetsOfType(widget.type).length > 1;
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
      this.editingLayout?.monitors ?? []
    );
  }

  /**
   * Enables a widget on the given monitor and drops it in the middle of it, on
   * top of whatever is already there. A widget that belonged to another
   * monitor now belongs to this one.
   */
  addWidgetToMonitor(id: string, monitorName: string) {
    const widget = this.getWidget(id);
    const monitor = this.layoutRecords.monitorByName(monitorName);

    if (!widget || !monitor) return;

    this.pushUndo();

    const occupied = widgetsOnMonitor(this.enabledWidgets, monitorName).filter(
      (placed) => placed.id !== id
    );

    const spot = spotForAddedWidget(widget, monitor, occupied, this.allWidgets);

    widget.monitor = monitorName;
    widget.userSettings.x = spot.x;
    widget.userSettings.y = spot.y;
    widget.userSettings.zIndex = spot.zIndex;
    widget.userSettings.enabled = true;

    this.bumpMutation(id);
  }

  /**
   * Moves a widget, never off its own monitor: the position is clamped so the
   * whole widget stays inside it. Handing a widget to another monitor is
   * `moveWidgetToMonitor`, never a drag.
   */
  updatePosition(id: string, x: number, y: number) {
    const widget = this.getWidget(id);

    if (!widget) return;

    const monitor = monitorForWidget(
      widget,
      this.editingLayout?.monitors ?? []
    );
    const position = monitor
      ? clampToBounds(
          monitor.bounds,
          { x, y },
          {
            width: widget.userSettings.currentWidth,
            height: widget.userSettings.currentHeight,
          }
        )
      : { x, y };

    if (
      widget.userSettings.x !== position.x ||
      widget.userSettings.y !== position.y
    ) {
      widget.userSettings.x = position.x;
      widget.userSettings.y = position.y;

      this.bumpMutation(id);
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

      this.bumpMutation(id);
    }
  }

  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.getWidget(id);

    if (!widget) return;

    const type = widget.type;
    let resolvedPartial = partial;

    if (
      type === 'fuel' &&
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

    applyLayoutResize(type, widget, prevSettings, widget.userSettings);

    this.bumpMutation(id);

    if (type === 'fuel' && 'pitWarningLaps' in resolvedPartial) {
      setPitWarningLapsSilent(
        (resolvedPartial as FuelWidgetSettings).pitWarningLaps
      );
    }

    if (type === 'fuel' && 'fuelAvgWindow' in resolvedPartial) {
      setFuelAvgWindowSilent(
        (resolvedPartial as FuelWidgetSettings).fuelAvgWindow
      );
    }

    if (type === 'fuel' && 'countYellowFlagLaps' in resolvedPartial) {
      setFuelCountYellowLapsSilent(
        (resolvedPartial as FuelWidgetSettings).countYellowFlagLaps
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
    const layout = this.editingLayout;

    if (!layout) return;

    layout.monitors = monitors.map(cloneMonitor);
  }

  loadEditingLayoutWidgets() {
    const layout = this.editingLayout;

    if (!layout) return;

    this.setWidgets(layout.widgets);
  }

  /**
   * The enabled widgets standing on one named screen of the active layout.
   *
   * `ownMonitorWidgets` answers the same question for the window asking; this
   * answers it about a screen the caller names, which is what the settings page
   * needs to list a remote screen's widgets without being one.
   */
  widgetsOnMonitorNamed(monitorName: string): WidgetDefaultConfig[] {
    return widgetsOnMonitor(this.enabledWidgets, monitorName);
  }

  /**
   * Every widget of the active layout, grouped by the screen it belongs to.
   *
   * The editor lists widgets this way because a layout spreads over screens
   * that are nothing alike — the one being raced on, a tablet, a browser source
   * — and each of them has its own set. A widget naming no screen of the layout
   * comes back under a null monitor rather than being dropped: it is exactly
   * the one the user has lost.
   */
  get widgetsByScreen(): {
    monitor: LayoutMonitor | null;
    widgets: WidgetDefaultConfig[];
  }[] {
    const monitors = this.editingLayout?.monitors ?? [];
    const groups = monitors.map((monitor) => ({
      monitor: monitor as LayoutMonitor | null,
      widgets: [] as WidgetDefaultConfig[],
    }));

    const offScreen: WidgetDefaultConfig[] = [];

    for (const widget of this.allWidgets) {
      const owner = monitorForWidget(widget, monitors);
      const group = groups.find((entry) => entry.monitor === owner);

      if (group) {
        group.widgets.push(widget);
      } else {
        offScreen.push(widget);
      }
    }

    const populated = groups.filter((group) => group.widgets.length > 0);

    if (offScreen.length > 0) {
      populated.push({ monitor: null, widgets: offScreen });
    }

    return populated;
  }

  /**
   * Which instance of its widget this record is, counting from one, and how
   * many instances there are in the layout. `1 of 1` is a widget that stands
   * in the layout once.
   */
  copyOrdinalOf(widgetId: string): { ordinal: number; total: number } {
    const widget = this.getWidget(widgetId);

    if (!widget) return { ordinal: 1, total: 1 };

    const copies = this.widgetsOfType(widget.type);

    return {
      ordinal: copies.findIndex((entry) => entry.id === widgetId) + 1,
      total: copies.length,
    };
  }

  // Widgets drawn by this overlay window: the ones that belong to its monitor.
  get ownMonitorWidgets(): WidgetDefaultConfig[] {
    const monitorName = this.ownMonitorName;
    const monitors = this.editingLayout?.monitors ?? [];

    if (!monitorName || monitors.length === 0) return [];

    return widgetsOnMonitor(this.enabledWidgets, monitorName);
  }

  /**
   * The widgets this overlay window actually draws, of the layout on screen.
   *
   * `ownMonitorWidgets` answers the same question for the layout under the
   * editor's cursor, which is what the canvas wants while a preview is open.
   * The telemetry mask is about what is being rendered for the driver, so it
   * reads the live layout: a session auto-switch has to move the appetite with
   * it even while the editor holds another layout open.
   */
  get liveOwnMonitorWidgets(): WidgetDefaultConfig[] {
    const monitorName = this.ownMonitorName;
    const monitors = this.layoutRecords.liveLayout?.monitors ?? [];

    if (!monitorName || monitors.length === 0) return [];

    const enabled = this.liveWidgets.filter(
      (widget) => widget.userSettings.enabled
    );

    return widgetsOnMonitor(enabled, monitorName);
  }

  get enabledWidgets(): WidgetDefaultConfig[] {
    return this.allWidgets.filter((widget) => widget.userSettings.enabled);
  }

  // Monitors of the layout on screen that actually have something to draw. A
  // full-screen transparent always-on-top window costs DWM composition over the
  // game and a copy of every telemetry bundle, so empty screens get none.
  get populatedMonitorNames(): string[] {
    const monitors = this.layoutRecords.liveLayout?.monitors ?? [];
    const enabledIds = new Set(this.liveEnabledWidgetIds);
    const enabled = this.liveWidgets.filter((widget) =>
      enabledIds.has(widget.id)
    );

    return monitors
      .filter(
        (monitor) =>
          isDisplayMonitor(monitor) &&
          widgetsOnMonitor(enabled, monitor.name).length > 0
      )
      .map((monitor) => monitor.name);
  }

  /**
   * The widgets drawn on remote screens, of the layout on screen.
   *
   * Remote screens hold no webview of this app — the browsers on the LAN are
   * fed by the mirror — so nothing registers their appetite for the gated
   * telemetry fields unless main does it for them.
   */
  get liveRemoteScreenWidgets(): WidgetDefaultConfig[] {
    const monitors = this.layoutRecords.liveLayout?.monitors ?? [];
    const remoteNames = monitors
      .filter((monitor) => !isDisplayMonitor(monitor))
      .map((monitor) => monitor.name);

    if (remoteNames.length === 0) return [];

    return this.liveWidgets.filter((widget) => {
      const owner = monitorForWidget(widget, monitors);

      return owner ? remoteNames.includes(owner.name) : false;
    });
  }

  // Applies widgets synced in from an overlay window. Only the widgets that
  // window owns are taken: it knows nothing about the other monitors, and its
  // copy of them would be stale.
  applySettingsSyncForMonitor(
    monitorName: string,
    widgets: WidgetDefaultConfig[]
  ) {
    // The live layout, never the edited one: an overlay window draws what is on
    // screen, so its F9 drag belongs to that layout even when the editor has
    // another one open beside it.
    const layout = this.layoutRecords.liveLayout;

    if (!layout) return;

    for (const widget of widgets) {
      const live = layout.widgets.find((entry) => entry.id === widget.id);

      // Ownership is read off this window's record, not the incoming copy: a
      // widget main has just moved elsewhere is no longer that window's to
      // report, however it still sees it.
      if (!live || live.monitor !== monitorName) continue;

      Object.assign(live.userSettings, widget.userSettings);

      // Derived from the settings just applied, never from the incoming copy:
      // the overlay knows only its own monitor, so its stored width can be
      // stale even when the settings it sends are not.
      live.designWidth = deriveWidgetDesignWidth(
        live.type,
        live.userSettings,
        live.designWidth
      );
    }

    this.mutations.recordSynced();
  }

  /**
   * Hands a widget to another monitor of the layout, keeping its relative
   * place on screen and every setting it has. This is the only way a widget
   * changes monitor — a drag never does.
   */
  moveWidgetToMonitor(widgetId: string, targetMonitorName: string) {
    const layout = this.editingLayout;
    const widget = this.widgets.get(widgetId);

    if (!layout || !widget) return;

    const from = monitorForWidget(widget, layout.monitors);
    const to = layout.monitors.find(
      (monitor) => monitor.name === targetMonitorName
    );

    if (!to || from?.name === to.name) return;

    this.pushUndo();

    const moved = from
      ? placeWidgetOnMonitor(widget, from.bounds, to.bounds).userSettings
      : clampToBounds(to.bounds, widget.userSettings, {
          width: widget.userSettings.currentWidth,
          height: widget.userSettings.currentHeight,
        });

    widget.monitor = to.name;
    widget.userSettings.x = moved.x;
    widget.userSettings.y = moved.y;
    widget.userSettings.zIndex = topZIndex(this.allWidgets, widgetId) + 1;
    this.bumpMutation(widgetId);
  }

  /**
   * A detached deep-ish copy of the active layout's widgets, for the two
   * callers that need one: the undo stack, and copying this layout's widgets
   * into a different layout record. (structuredClone throws on MobX proxies.)
   */
  private snapshotWidgets(): WidgetDefaultConfig[] {
    return this.allWidgets.map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));
  }

  setLayouts(layouts: SavedLayout[], editingLayoutId?: string | null) {
    this.layoutRecords.setLayouts(layouts, editingLayoutId);

    const editingLayout = this.layoutRecords.editingLayout;

    if (editingLayout) {
      this.setWidgets(editingLayout.widgets);
    }
  }

  /**
   * The starter set a fresh layout opens with — read by the record store when
   * it creates one, which is why this is public. `monitorName` is the monitor
   * the set stands on; without one, `setWidgets` gives it the layout's
   * primary monitor when it is installed.
   */
  starterWidgets(
    clean: boolean = false,
    monitorName?: string
  ): WidgetDefaultConfig[] {
    const starter = buildStarterWidgets(
      this.widgetDefaults.snapshot(),
      this.overlayResolution,
      clean
    );

    if (monitorName === undefined) return starter;

    return starter.map((widget) => ({ ...widget, monitor: monitorName }));
  }

  /**
   * The layout the live widgets came from. Private on purpose: a caller that
   * wants the record asks `root.layouts`, and what this store exposes is the
   * working copy, not the record behind it.
   */
  private get editingLayout(): SavedLayout | undefined {
    return this.layoutRecords.editingLayout;
  }

  // Selecting a layout loads its saved widgets into the live store. Repointing
  // editingLayoutId alone would let the commit reaction clobber the selected
  // layout with the previously-active layout's stale widgets.
  selectLayout(id: string | null) {
    if (id) {
      this.loadLayout(id);

      return;
    }

    this.layoutRecords.setEditingLayoutId(null);
    this.bumpMutation();
  }

  loadLayout(id: string) {
    const layout = this.layoutRecords.byId(id);

    if (!layout) return;

    // Loading is the unqualified version of the switch: this layout becomes
    // both the one being edited and the one on screen.
    this.layoutRecords.setPinnedLiveLayoutId(null);
    this.layoutRecords.setEditingLayoutId(id);

    if (layout.monitors.length > 0) {
      this.setWidgets(layout.widgets);
    } else {
      // No monitor config yet (e.g. a brand-new layout whose auto-resolve
      // hasn't landed). Fall back to a blank layout instead of silently
      // leaving the previously-active layout's widgets on screen.
      this.setWidgets(this.starterWidgets(true));
    }

    this.bumpMutation();
  }

  updateLayout(id: string) {
    const layout = this.layoutRecords.byId(id);

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = this.snapshotWidgets();
    this.bumpMutation();
  }

  /**
   * The settings a widget *store* reads: those of the instance that speaks for
   * the widget (`primaryInstanceOf`). A store is one per app, so it cannot
   * follow every instance — it follows the one on the driver's screen.
   *
   * Never use this from a component: a component renders one instance and
   * reads that instance's own settings through `getSettings` (or
   * `useWidgetSettings`).
   */
  settingsOfType<SpecificSettings extends WidgetSpecificSettings>(
    type: string
  ): BaseUserSettings & SpecificSettings {
    const instance = this.primaryInstanceOf(type);

    return this.getSettings<SpecificSettings>(instance?.id ?? type);
  }

  getSettings<SpecificSettings extends WidgetSpecificSettings>(
    widgetId: string
  ): BaseUserSettings & SpecificSettings {
    void this.mutations.syncToken;
    void this.mutations.changeToken;

    const widget = this.getWidget(widgetId);

    // A copy asks by its own id, so the shipped defaults are found through its
    // type; a caller naming a type directly still lands on the right record,
    // since the original copy's id is its type.
    const type = widget ? widget.type : widgetTypeFromId(widgetId);
    const defaultConfig = DEFAULT_WIDGET_BY_ID.get(type);
    const defaultSettings = defaultConfig?.userSettings as
      | (BaseUserSettings & SpecificSettings)
      | undefined;

    return (
      (widget?.userSettings as unknown as BaseUserSettings &
        SpecificSettings) ?? defaultSettings
    );
  }
}

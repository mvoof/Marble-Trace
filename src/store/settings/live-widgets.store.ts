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
  defaultMonitorOf,
  hotkeysActOn,
  monitorForWidget,
  placeWidgetOnMonitor,
  widgetsOnMonitor,
} from '@store/settings/virtual-desktop';
import { isDisplayMonitor } from '@utils/remote-screen';
import { WidgetHistory } from '@store/settings/widget-history';
import {
  bottomZIndex,
  buildStarterWidgets,
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

// How much of an auto-height widget is kept on its monitor when it is dragged
// down — its real height is not known to the store.
const AUTO_HEIGHT_VISIBLE_PX = 24;

export type { PickableWidget };

// Where a widget stands, rather than how it looks: never carried by a settings
// copy or a reset.
const GEOMETRY_KEYS = [
  'enabled',
  'x',
  'y',
  'currentWidth',
  'currentHeight',
  'zIndex',
] as const;

/**
 * The box a widget is kept inside its monitor by. An auto-height widget draws
 * as tall as its content, and its `currentHeight` is only the manifest's number
 * — usually taller than what it draws — so clamping by it would stop the widget
 * short of the bottom edge. Only a strip along its top is kept on screen, so
 * it can never be dragged out of sight entirely.
 */
const clampSizeOf = (
  widget: WidgetDefaultConfig
): { width: number; height: number } => ({
  width: widget.userSettings.currentWidth,
  height: widget.autoHeight
    ? Math.min(AUTO_HEIGHT_VISIBLE_PX, widget.userSettings.currentHeight)
    : widget.userSettings.currentHeight,
});

// A deep copy: a nested value (a column set, a colour map) shared by reference
// between two instances would let an edit to one change the other.
const withoutGeometry = (
  settings: WidgetUserSettings
): Partial<WidgetUserSettings> => {
  const copied = JSON.parse(
    JSON.stringify(settings)
  ) as Partial<WidgetUserSettings>;

  for (const key of GEOMETRY_KEYS) {
    delete copied[key];
  }

  return copied;
};

/** One widget on one monitor's list in the editor. */
export interface MonitorWidgetRow {
  type: string;
  label: string;
  /** Whether the connected sim can feed it at all. */
  available: boolean;
  /** Its instances on this monitor, in layout order. Empty: never switched on here. */
  instances: WidgetDefaultConfig[];
}

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
    const layout = this.editingLayout;

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

  // Name shown in the overlay's "layout switched" toast; null once it expires.
  layoutActivatedToast: string | null = null;

  private layoutToastTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Main side, while a client's command runs (`applyClientCommand`): every
   * write lands in the live layout instead of the edited one, and leaves no
   * undo step.
   */
  private applyingClientCommand = false;

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
    return this.onScreenWidgetTypes.includes(widgetType);
  }

  /**
   * The widget types `isWidgetOnScreen` answers yes for, sorted — what the
   * hotkey dispatcher gates on. Addressed by type, not by copy: a binding
   * belongs to the widget, so it fires while any copy of it is on screen.
   * Which copies it then reaches is the action's own business.
   */
  get onScreenWidgetTypes(): string[] {
    const live = new Set(this.liveEnabledWidgetIds);
    const types = new Set<string>();

    for (const widget of this.liveWidgets) {
      if (live.has(widget.id)) {
        types.add(widget.type);
      }
    }

    return Array.from(types).sort();
  }

  cycleStandingsViewMode() {
    const order: StandingsViewMode[] = ['all', 'grouped', 'cycling'];
    const leader = this.hotkeyLeaderOf('standings');

    if (!leader) return;

    const current = this.getSettings<StandingsWidgetSettings>(leader.id);
    const viewMode =
      order[(order.indexOf(current.viewMode) + 1) % order.length];

    // Every instance under the hotkeys lands on the same mode, so a stream
    // that had drifted from the driver's screen is brought back in line.
    for (const widget of this.hotkeyInstancesOf('standings')) {
      this.updateUserSettings(widget.id, { viewMode });
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

    const leader = this.hotkeyLeaderOf('delta');

    if (!leader) return;

    const current = this.getSettings<DeltaWidgetSettings>(leader.id);
    const reference =
      order[(order.indexOf(current.reference) + 1) % order.length];

    // Same reasoning as the standings view mode above.
    for (const widget of this.hotkeyInstancesOf('delta')) {
      this.updateUserSettings(widget.id, { reference });
    }
  }

  pushUndo() {
    // The editor's history is the editor's: a drag on an overlay is not a step
    // the editor's undo button walks back.
    if (this.applyingClientCommand) return;

    this.history.push(this.snapshotWidgets());
  }

  /**
   * Runs an overlay's command (ADR-0007) through the same methods the editor
   * uses — clamping to the monitor, the layout resize of a column toggle, the
   * fuel values the backend keeps — but against the layout on screen, which
   * is the one the overlay draws, and without an undo step.
   */
  applyClientCommand<Result>(command: () => Result): Result {
    this.applyingClientCommand = true;

    try {
      return command();
    } finally {
      this.applyingClientCommand = false;
    }
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
    this.mutations.record();
  }

  /**
   * Brings a widget list up to the current shape and installs it as the
   * active layout's widgets: stored settings are merged over the shipped
   * defaults, a design width that is derived rather than stored is recomputed,
   * and every widget is given a monitor of this layout to belong to.
   *
   * A widget the list holds no instance of at all is added, switched off, on
   * the first display: every widget the build ships has at least one record
   * in a layout, so there is always one to switch on.
   *
   * Normalizing here rather than on read is what lets `widgets` be a plain
   * projection: a widget is repaired once, when the layout is installed, and
   * the repair is written to the record everything else reads.
   */
  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      const layout = this.widgetOwner;
      const primary = layout ? defaultMonitorOf(layout) : undefined;

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
            ...(savedWidget.hotkeys === undefined
              ? {}
              : { hotkeys: savedWidget.hotkeys }),
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
   * Gives a widget that stands on no monitor of this layout the first display,
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

    const { x, y } = clampToBounds(
      primary.bounds,
      widget.userSettings,
      clampSizeOf(widget)
    );

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
   * layout being loaded and wrong for a list that is already the answer — the
   * window would draw records its sender never had.
   *
   * Used where a list arrives already normalized: a client installing main's
   * snapshot, a preview mirroring the main window's widgets.
   */
  syncWidgetSet(widgets: WidgetDefaultConfig[]) {
    const known = this.widgets;

    // The set is what this is for, and the set almost never changes: a drag
    // sends a snapshot every few frames, and rebuilding the collection each time
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

      this.mutations.record();
    });
  }

  applySettingsSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (!existing) continue;

        this.patchFromSync(existing, incoming);
      }

      this.mutations.record();
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

    if (incoming.hotkeys === undefined) {
      delete existing.hotkeys;
    } else {
      existing.hotkeys = incoming.hotkeys;
    }

    existing.designWidth = deriveWidgetDesignWidth(
      incoming.type,
      existing.userSettings,
      incoming.designWidth
    );
    existing.designHeight = incoming.designHeight;
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
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
    void this.mutations.changeToken;

    return this.allWidgets.filter((widget) => widget.type === type);
  }

  /**
   * The instances of a widget its hotkeys act on: the ones marked for it
   * (`hotkeysActOn`), browser screens included.
   */
  hotkeyInstancesOf(type: string): WidgetDefaultConfig[] {
    return this.widgetsOfType(type).filter(hotkeysActOn);
  }

  /**
   * The instance a cycling hotkey reads the current value from before writing
   * the next one to every marked instance: the primary one when it is marked,
   * else the first marked.
   */
  private hotkeyLeaderOf(type: string): WidgetDefaultConfig | undefined {
    const marked = this.hotkeyInstancesOf(type);
    const primary = this.primaryInstanceOf(type);

    return primary && marked.includes(primary) ? primary : marked[0];
  }

  /** Whether the widget's hotkeys act on this instance. */
  hotkeysActOnWidget(id: string): boolean {
    const widget = this.getWidget(id);

    return widget ? hotkeysActOn(widget) : false;
  }

  /**
   * Marks an instance for the widget's hotkeys, or unmarks it. Stored only
   * where it departs from the default.
   */
  setHotkeysActOn(id: string, actsOn: boolean) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    if (actsOn) {
      delete widget.hotkeys;
    } else {
      widget.hotkeys = false;
    }

    this.bumpMutation();
  }

  /**
   * The visibility hotkey: every instance it acts on goes the same way — off
   * while any of them is on screen, on when none is.
   */
  toggleVisibilityByHotkey(type: string) {
    const instances = this.hotkeyInstancesOf(type);

    if (instances.length === 0) return;

    const show = !instances.some((widget) => widget.userSettings.enabled);

    this.pushUndo();

    for (const widget of instances) {
      this.updateUserSettings(widget.id, { enabled: show });
    }
  }

  /**
   * The instance that speaks for a widget where only one answer is possible: a
   * setting the backend keeps once, or a widget store, which is one per app and
   * so cannot be per instance.
   *
   * The one the driver works with wins — switched on and under the widget's
   * hotkeys — then any switched-on instance, then any under the hotkeys, then
   * the first. Within each, a physical display goes ahead of a browser screen:
   * the driver's own screen speaks for the widget, not the stream copying it.
   */
  primaryInstanceOf(type: string): WidgetDefaultConfig | undefined {
    const monitors = this.editingLayout?.monitors ?? [];
    const isOnBrowserScreen = (widget: WidgetDefaultConfig) =>
      monitorForWidget(widget, monitors)?.kind === 'remote';
    const instances = [
      ...this.widgetsOfType(type).filter(
        (widget) => !isOnBrowserScreen(widget)
      ),
      ...this.widgetsOfType(type).filter(isOnBrowserScreen),
    ];
    const hotkeyed = new Set(this.hotkeyInstancesOf(type));

    return (
      instances.find(
        (widget) => widget.userSettings.enabled && hotkeyed.has(widget)
      ) ??
      instances.find((widget) => widget.userSettings.enabled) ??
      instances.find((widget) => hotkeyed.has(widget)) ??
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
      ? clampToBounds(monitor.bounds, offset, clampSizeOf(source))
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
   * Removes a copy for good: an instance that is not the first of its widget
   * on its own monitor. The first one is the widget on that screen, and the
   * monitor's switch is what takes it off — it keeps its settings for the
   * next time it is switched on.
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

  /**
   * The other instances of the same widget a settings copy can be taken from,
   * on any monitor of the layout.
   */
  settingsSourcesFor(id: string): WidgetDefaultConfig[] {
    const widget = this.getWidget(id);

    if (!widget) return [];

    return this.widgetsOfType(widget.type).filter((entry) => entry.id !== id);
  }

  /**
   * Gives an instance another instance's settings — its columns, colours,
   * scale of text — while it keeps its own place, size and switch. Goes
   * through `updateUserSettings`, so a copied orientation or column set
   * reshapes the widget the way a toggle would.
   */
  copySettingsFrom(targetId: string, sourceId: string) {
    const target = this.getWidget(targetId);
    const source = this.getWidget(sourceId);

    if (!target || !source || target.type !== source.type) return;

    this.pushUndo();
    this.updateUserSettings(targetId, withoutGeometry(source.userSettings));
  }

  /**
   * Puts an instance's settings back to the widget's shipped defaults, keeping
   * its place, size and switch.
   */
  resetSettings(id: string) {
    const widget = this.getWidget(id);
    const shipped = widget ? DEFAULT_WIDGET_BY_ID.get(widget.type) : undefined;

    if (!widget || !shipped) return;

    this.pushUndo();
    this.updateUserSettings(id, withoutGeometry(shipped.userSettings));
  }

  /** Whether `removeWidgetCopy` would take this instance out of the layout. */
  canRemoveWidget(id: string): boolean {
    return this.copyOrdinalOf(id).ordinal > 1;
  }

  /**
   * Widgets the F9 picker can put on a screen: every widget not already
   * switched on there. Picking one goes through `setTypeEnabledOnMonitor`, so
   * it lands on this screen whatever any other screen shows.
   */
  pickableWidgetsForMonitor(monitorName: string): PickableWidget[] {
    return this.monitorWidgetRows(monitorName)
      .filter(
        (row) => !row.instances.some((widget) => widget.userSettings.enabled)
      )
      .map((row) => ({
        id: row.type,
        type: row.type,
        label: row.label,
        description: DEFAULT_WIDGET_BY_ID.get(row.type)?.description,
        available: row.available,
      }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }

  /**
   * Where `updatePosition` would put a widget, without putting it there — an
   * overlay draws a drag at once and lets main make it so.
   */
  clampedPosition(id: string, x: number, y: number): { x: number; y: number } {
    const widget = this.getWidget(id);
    const monitor = widget
      ? monitorForWidget(widget, this.editingLayout?.monitors ?? [])
      : undefined;

    return widget && monitor
      ? clampToBounds(monitor.bounds, { x, y }, clampSizeOf(widget))
      : { x, y };
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
      ? clampToBounds(monitor.bounds, { x, y }, clampSizeOf(widget))
      : { x, y };

    if (
      widget.userSettings.x !== position.x ||
      widget.userSettings.y !== position.y
    ) {
      widget.userSettings.x = position.x;
      widget.userSettings.y = position.y;

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

    this.bumpMutation();

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

  /**
   * Client side (an overlay): installs the screen main sent — the live
   * layout's id and name, this window's monitor, and the widgets standing on
   * it. The widgets are adopted as `syncWidgetSet` adopts them: main sent them
   * already normalized, and a widget it no longer lists is gone.
   */
  applyClientScreen(screen: {
    layoutId: string;
    layoutName: string;
    monitor: LayoutMonitor;
    widgets: WidgetDefaultConfig[];
  }) {
    runInAction(() => {
      this.layoutRecords.installClientLayout(
        screen.layoutId,
        screen.layoutName,
        screen.monitor
      );
      this.syncWidgetSet(screen.widgets);
    });
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
   * One monitor's own widget list, as the editor shows it: every widget the
   * build ships, each with its instances on this monitor — none, when it has
   * never been switched on here. A monitor added a minute ago lists every
   * widget, all off.
   */
  monitorWidgetRows(monitorName: string): MonitorWidgetRow[] {
    const onMonitor = widgetsOnMonitor(this.allWidgets, monitorName);
    const available = new Set(
      availableWidgetIdsOf(DEFAULT_WIDGETS, this.capabilitiesOf())
    );

    return DEFAULT_WIDGETS.map((shipped) => ({
      type: shipped.id,
      label: shipped.label,
      available: available.has(shipped.id),
      instances: onMonitor.filter((widget) => widget.type === shipped.id),
    }));
  }

  /**
   * The switch of one widget on one monitor's list. On: an instance already
   * standing on this monitor is switched back on — with every setting it had —
   * or, when there is none, a new one is made from the widget's template and
   * placed in a free spot. Off: every instance of it on this monitor goes off;
   * nothing on any other monitor is touched.
   *
   * Returns the instance switched on, so the editor can select it.
   */
  setTypeEnabledOnMonitor(
    type: string,
    monitorName: string,
    enabled: boolean
  ): string | null {
    const layout = this.widgetOwner;
    const monitor = layout?.monitors.find(
      (entry) => entry.name === monitorName
    );

    if (!layout || !monitor || !DEFAULT_WIDGET_BY_ID.has(type)) return null;

    const instances = widgetsOnMonitor(this.allWidgets, monitorName).filter(
      (widget) => widget.type === type
    );

    if (!enabled) {
      const switchedOn = instances.filter(
        (widget) => widget.userSettings.enabled
      );

      if (switchedOn.length === 0) return null;

      this.pushUndo();

      for (const widget of switchedOn) {
        widget.userSettings.enabled = false;
      }

      this.bumpMutation();

      return null;
    }

    const alreadyOn = instances.find((widget) => widget.userSettings.enabled);

    if (alreadyOn) return alreadyOn.id;

    this.pushUndo();

    const reused = instances[0];

    if (reused) {
      reused.userSettings.enabled = true;
      this.bumpMutation();

      return reused.id;
    }

    const created = this.instanceFromTemplate(type, monitor);

    layout.widgets.push(created);
    this.bumpMutation();

    return created.id;
  }

  /**
   * A new, switched-on instance of a widget on a monitor, starting from the
   * template the Widgets page edits and dropped where nothing else stands.
   */
  private instanceFromTemplate(
    type: string,
    monitor: LayoutMonitor
  ): WidgetDefaultConfig {
    const template =
      this.widgetDefaults.getWidget(type) ?? DEFAULT_WIDGET_BY_ID.get(type)!;
    const taken = this.widgets;

    const instance: WidgetDefaultConfig = {
      ...template,
      id: taken.has(type) ? nextInstanceId(type, taken.keys()) : type,
      type,
      monitor: monitor.name,
      userSettings: { ...template.userSettings, enabled: true },
    };

    const occupied = widgetsOnMonitor(this.enabledWidgets, monitor.name);
    const spot = spotForAddedWidget(
      instance,
      monitor,
      occupied,
      this.allWidgets
    );

    instance.userSettings.x = spot.x;
    instance.userSettings.y = spot.y;
    instance.userSettings.zIndex = spot.zIndex;

    return instance;
  }

  /**
   * Which instance of its widget this record is, counting from one, and how
   * many instances there are in the layout. `1 of 1` is a widget that stands
   * in the layout once.
   */
  copyOrdinalOf(widgetId: string): { ordinal: number; total: number } {
    const widget = this.getWidget(widgetId);

    if (!widget) return { ordinal: 1, total: 1 };

    // Counted on its own monitor: every monitor has its own set, so the
    // widget's first instance there is the widget on that screen, not a copy
    // of one standing somewhere else.
    const copies = this.widgetsOfType(widget.type).filter(
      (entry) => entry.monitor === widget.monitor
    );

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
      : clampToBounds(to.bounds, widget.userSettings, clampSizeOf(widget));

    widget.monitor = to.name;
    widget.userSettings.x = moved.x;
    widget.userSettings.y = moved.y;
    widget.userSettings.zIndex = topZIndex(this.allWidgets, widgetId) + 1;
    this.bumpMutation();
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
   * the set stands on; without one, `setWidgets` gives it the layout's first
   * display when it is installed.
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
    return this.applyingClientCommand
      ? this.layoutRecords.liveLayout
      : this.layoutRecords.editingLayout;
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

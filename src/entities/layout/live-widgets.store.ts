import { makeAutoObservable, runInAction } from 'mobx';
import {
  DEFAULT_WIDGETS,
  DEFAULT_WIDGET_BY_ID,
} from '@entities/widget/widget-catalog';
import { widgetTypeFromId } from '@entities/widget/widget-instance';
import type { LayoutsStore } from '@entities/layout/layouts.store';
import type { SettingsMutationLog } from '@entities/layout/mutation-log.store';
import { availableWidgetIdsOf } from '@entities/widget/widget-availability';
import {
  hotkeyLeaderAmong,
  nextCycleValue,
  primaryInstanceAmong,
  visibilityAfterToggle,
} from '@entities/layout/hotkey-targets';
import {
  clampOnOwnMonitor,
  monitorMoveOf,
  withoutGeometry,
} from '@entities/layout/widget-geometry';
import {
  copyOrdinalAmong,
  detachedCopiesOf,
  duplicateOf,
  insertAfter,
  instanceFromTemplate,
  monitorSwitchOf,
} from '@entities/layout/widget-instances';
import { normalizeWidgets } from '@entities/layout/widget-normalize';
import {
  adoptWidgetSet,
  isSameWidgetSet,
  patchFromSync,
} from '@entities/layout/widget-sync';
import {
  applySettingsEdit,
  markForHotkeys,
  moveWidgetTo,
  resizeWidgetTo,
} from '@entities/layout/widget-edits';
import {
  shownWidgetIdsByZOrder,
  shownWidgetIdsOf,
  shownWidgetTypesOf,
} from '@entities/layout/widget-visibility';
import {
  monitorWidgetRowsOf,
  pickableWidgetsOf,
  populatedMonitorNamesOf,
  remoteScreenWidgetsOf,
  type MonitorWidgetRow,
} from '@entities/layout/monitor-widgets';

import type {
  WidgetDefaultConfig,
  BaseUserSettings,
  LayoutResolution,
  LayoutMonitor,
  SavedLayout,
  WidgetUserSettings,
} from '@shared/contracts/widget-settings';
import { DEFAULT_LAYOUT_RESOLUTION } from '@entities/layout/layout-resolution';
import {
  hotkeysActOn,
  widgetsOnMonitor,
} from '@entities/layout/virtual-desktop';
import { WidgetHistory } from '@entities/layout/widget-history.store';
import {
  bottomZIndex,
  buildStarterWidgets,
  topZIndex,
  type PickableWidget,
} from '@entities/widget/widget-placement';
import type { WidgetMap } from '@entities/widget/widget-map';
import type { WidgetDefaultsStore } from '@entities/widget/widget-defaults.store';
import type { CapabilitiesPayload } from '@shared/contracts/generated/bindings';

export type { MonitorWidgetRow, PickableWidget };

/**
 * The writes that change a widget's settings — what an editor does to a
 * layout. Main makes them; a client asks main to (ADR-0007).
 */
type WidgetSettingsWrite =
  | 'updatePosition'
  | 'updateSize'
  | 'updateUserSettings'
  | 'setWidgetEnabled'
  | 'setTypeEnabledOnMonitor'
  | 'duplicateWidget'
  | 'removeWidgetCopy'
  | 'copySettingsFrom'
  | 'resetSettings'
  | 'bringToFront'
  | 'sendToBack'
  | 'setHotkeysActOn'
  | 'toggleVisibilityByHotkey'
  | 'cycleSetting'
  | 'moveWidgetToMonitor'
  | 'loadLayout'
  | 'selectLayout'
  | 'setLayouts'
  | 'setWidgets'
  | 'pushUndo'
  | 'undo'
  | 'redo'
  | 'applyClientCommand';

/**
 * The widget store as a client holds it — an overlay, a remote screen: every
 * read, and the installs a snapshot arrives through, but none of the writes.
 * An overlay that changes a setting sends a command (`SettingsClientStore`); a
 * write reached from its root does not compile.
 */
export type LiveWidgetsView = Omit<LiveWidgetsStore, WidgetSettingsWrite>;

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

    makeAutoObservable<LiveWidgetsStore, 'mutations' | 'capabilitiesOf'>(
      this,
      {
        mutations: false,
        capabilitiesOf: false,
      },
      {
        autoBind: true,
      }
    );
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
    return shownWidgetIdsOf(
      this.liveWidgets,
      availableWidgetIdsOf(this.liveWidgets, this.capabilitiesOf())
    );
  }

  get availableWidgetIds(): string[] {
    return availableWidgetIdsOf(this.widgets.values(), this.capabilitiesOf());
  }

  get enabledWidgetIds(): string[] {
    return shownWidgetIdsByZOrder(
      this.widgets.values(),
      this.availableWidgetIds
    );
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
   * hotkey dispatcher gates on. Which copies a binding then reaches is the
   * action's own business.
   */
  get onScreenWidgetTypes(): string[] {
    return shownWidgetTypesOf(this.liveWidgets, this.liveEnabledWidgetIds);
  }

  /**
   * Steps a choice setting to its next value on every instance under the
   * widget's hotkeys, from where the hotkey leader is — so a stream that had
   * drifted from the driver's screen is brought back in line. The cycles are
   * declared in the widgets' manifests (`hotkeyCycles`).
   */
  cycleSetting(type: string, setting: string, values: readonly string[]) {
    const leader = this.hotkeyLeaderOf(type);

    if (!leader || values.length === 0) return;

    const next = nextCycleValue(
      values,
      String(this.getSettings(leader.id)[setting])
    );

    for (const widget of this.hotkeyInstancesOf(type)) {
      this.updateUserSettings(widget.id, { [setting]: next });
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

  /** Installs a widget list as the active layout's, or as the detached map. */
  private installWidgets(widgets: WidgetDefaultConfig[]) {
    const layout = this.widgetOwner;

    if (layout) {
      layout.widgets = widgets;
    } else {
      this.detachedWidgets = new Map(
        widgets.map((widget) => [widget.id, widget])
      );
    }
  }

  /**
   * Brings a widget list up to the current shape (`normalizeWidgets`) and
   * installs it as the active layout's widgets.
   *
   * Normalizing here rather than on read is what lets `widgets` be a plain
   * projection: a widget is repaired once, when the layout is installed, and
   * the repair is written to the record everything else reads.
   */
  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      this.installWidgets(normalizeWidgets(widgets, this.widgetOwner));
      this.bumpMutation();
    });
  }

  /**
   * Installs a widget list a window received from elsewhere (`adoptWidgetSet`)
   * — a client installing main's snapshot, a preview mirroring the main
   * window's widgets. `applySettingsSync` patches records it already holds and
   * can express neither an instance that appeared nor one that was deleted.
   *
   * Deliberately not through `setWidgets`: that fills a widget the list left
   * out with its shipped default, which is right for a layout being loaded and
   * wrong for a list that is already the answer.
   */
  syncWidgetSet(widgets: WidgetDefaultConfig[]) {
    const known = this.widgets;

    if (isSameWidgetSet(known, widgets)) {
      this.applySettingsSync(widgets);

      return;
    }

    runInAction(() => {
      this.installWidgets(adoptWidgetSet(known, widgets));
      this.mutations.record();
    });
  }

  applySettingsSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (existing) {
          patchFromSync(existing, incoming);
        }
      }

      this.mutations.record();
    });
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
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

  /** See `hotkeyLeaderAmong`. */
  private hotkeyLeaderOf(type: string): WidgetDefaultConfig | undefined {
    return hotkeyLeaderAmong(this.widgetsOfType(type), this.editingMonitors);
  }

  /** Whether the widget's hotkeys act on this instance. */
  hotkeysActOnWidget(id: string): boolean {
    const widget = this.getWidget(id);

    return widget ? hotkeysActOn(widget) : false;
  }

  /** See `markForHotkeys`. */
  setHotkeysActOn(id: string, actsOn: boolean) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    markForHotkeys(widget, actsOn);
    this.bumpMutation();
  }

  /** The visibility hotkey — see `visibilityAfterToggle`. */
  toggleVisibilityByHotkey(type: string) {
    const instances = this.hotkeyInstancesOf(type);

    if (instances.length === 0) return;

    const show = visibilityAfterToggle(instances);

    this.pushUndo();

    for (const widget of instances) {
      this.updateUserSettings(widget.id, { enabled: show });
    }
  }

  /** The instance that speaks for a widget — see `primaryInstanceAmong`. */
  primaryInstanceOf(type: string): WidgetDefaultConfig | undefined {
    return primaryInstanceAmong(this.widgetsOfType(type), this.editingMonitors);
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.pushUndo();
    this.updateUserSettings(id, { enabled });
  }

  /**
   * Makes another instance of a widget (`duplicateOf`) and returns its id. The
   * copy then owns its settings: changing its columns, its scale or its
   * enabled flag leaves the source alone.
   *
   * Placed straight into the layout record rather than through `setWidgets`,
   * which normalizes a whole list — there is nothing to repair in a record
   * copied from one that was normalized when the layout was installed.
   */
  duplicateWidget(id: string): string | null {
    const source = this.getWidget(id);
    const layout = this.widgetOwner;

    if (!source || !layout) return null;

    this.pushUndo();

    const copy = duplicateOf(source, layout);

    insertAfter(layout.widgets, id, copy);
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
    const layout = this.widgetOwner;

    if (!this.getWidget(id) || !this.canRemoveWidget(id) || !layout) return;

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
   * Gives an instance another instance's settings while it keeps its own
   * place, size and switch. Goes through `updateUserSettings`, so a copied
   * orientation or column set reshapes the widget the way a toggle would.
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
   * Widgets the F9 picker can put on a screen (`pickableWidgetsOf`). Picking
   * one goes through `setTypeEnabledOnMonitor`, so it lands on this screen
   * whatever any other screen shows.
   */
  pickableWidgetsForMonitor(monitorName: string): PickableWidget[] {
    return pickableWidgetsOf(
      this.monitorWidgetRows(monitorName),
      (type) => DEFAULT_WIDGET_BY_ID.get(type)?.description
    );
  }

  /**
   * Where `updatePosition` would put a widget, without putting it there — an
   * overlay draws a drag at once and lets main make it so.
   */
  clampedPosition(id: string, x: number, y: number): { x: number; y: number } {
    const widget = this.getWidget(id);

    return widget
      ? clampOnOwnMonitor(widget, this.editingMonitors, { x, y })
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

    const position = clampOnOwnMonitor(widget, this.editingMonitors, { x, y });

    if (moveWidgetTo(widget, position)) {
      this.bumpMutation();
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.getWidget(id);

    if (widget && resizeWidgetTo(widget, width, height)) {
      this.bumpMutation();
    }
  }

  /** See `applySettingsEdit`. */
  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.getWidget(id);

    if (!widget) return;

    applySettingsEdit(widget, partial);
    this.bumpMutation();
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

  /** One monitor's own widget list, as the editor shows it (`monitorWidgetRowsOf`). */
  monitorWidgetRows(monitorName: string): MonitorWidgetRow[] {
    return monitorWidgetRowsOf(
      DEFAULT_WIDGETS,
      this.allWidgets,
      monitorName,
      new Set(availableWidgetIdsOf(DEFAULT_WIDGETS, this.capabilitiesOf()))
    );
  }

  /**
   * The switch of one widget on one monitor's list (`monitorSwitchOf`): on
   * reuses an instance already standing here, settings and all, or makes one
   * from the widget's template in a free spot; off touches nothing on any
   * other monitor.
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
    const change = monitorSwitchOf(instances, enabled);

    if (change.kind === 'unchanged') {
      return change.id;
    }

    this.pushUndo();

    let switchedOnId: string | null = null;

    if (change.kind === 'switchOff') {
      for (const widget of change.widgets) {
        widget.userSettings.enabled = false;
      }
    } else if (change.kind === 'switchOn') {
      change.widget.userSettings.enabled = true;
      switchedOnId = change.widget.id;
    } else {
      const template =
        this.widgetDefaults.getWidget(type) ?? DEFAULT_WIDGET_BY_ID.get(type)!;
      const created = instanceFromTemplate(template, type, monitor, layout);

      layout.widgets.push(created);
      switchedOnId = created.id;
    }

    this.bumpMutation();

    return switchedOnId;
  }

  /**
   * Which instance of its widget this record is, counting from one, and how
   * many instances there are (`copyOrdinalAmong`). `1 of 1` is a widget that
   * stands in the layout once.
   */
  copyOrdinalOf(widgetId: string): { ordinal: number; total: number } {
    const widget = this.getWidget(widgetId);

    if (!widget) return { ordinal: 1, total: 1 };

    return copyOrdinalAmong(widget, this.widgetsOfType(widget.type));
  }

  // Widgets drawn by this overlay window: the ones that belong to its monitor.
  get ownMonitorWidgets(): WidgetDefaultConfig[] {
    const monitorName = this.ownMonitorName;

    if (!monitorName || this.editingMonitors.length === 0) return [];

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

  /** Monitors of the layout on screen with something to draw (`populatedMonitorNamesOf`). */
  get populatedMonitorNames(): string[] {
    const shownIds = new Set(this.liveEnabledWidgetIds);

    return populatedMonitorNamesOf(
      this.layoutRecords.liveLayout?.monitors ?? [],
      this.liveWidgets.filter((widget) => shownIds.has(widget.id))
    );
  }

  /**
   * The widgets drawn on remote screens, of the layout on screen.
   *
   * Remote screens hold no webview of this app — the browsers on the LAN are
   * fed by the mirror — so nothing registers their appetite for the gated
   * telemetry fields unless main does it for them.
   */
  get liveRemoteScreenWidgets(): WidgetDefaultConfig[] {
    return remoteScreenWidgetsOf(
      this.layoutRecords.liveLayout?.monitors ?? [],
      this.liveWidgets
    );
  }

  /**
   * Hands a widget to another monitor of the layout (`monitorMoveOf`), keeping
   * its relative place on screen and every setting it has. This is the only
   * way a widget changes monitor — a drag never does.
   */
  moveWidgetToMonitor(widgetId: string, targetMonitorName: string) {
    const layout = this.editingLayout;
    const widget = this.widgets.get(widgetId);
    const move =
      layout && widget
        ? monitorMoveOf(widget, layout.monitors, targetMonitorName)
        : null;

    if (!widget || !move) return;

    this.pushUndo();

    widget.monitor = move.monitor;
    widget.userSettings.x = move.x;
    widget.userSettings.y = move.y;
    widget.userSettings.zIndex = topZIndex(this.allWidgets, widgetId) + 1;
    this.bumpMutation();
  }

  /** The active layout's widgets, detached — see `detachedCopiesOf`. */
  private snapshotWidgets(): WidgetDefaultConfig[] {
    return detachedCopiesOf(this.allWidgets);
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

  private get editingMonitors(): LayoutMonitor[] {
    return this.editingLayout?.monitors ?? [];
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

    // A layout with no monitor config yet (a brand-new one whose auto-resolve
    // has not landed) opens blank rather than silently leaving the
    // previously-active layout's widgets on screen.
    this.setWidgets(
      layout.monitors.length > 0 ? layout.widgets : this.starterWidgets(true)
    );
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
  settingsOfType<SpecificSettings extends object = Record<string, unknown>>(
    type: string
  ): BaseUserSettings & SpecificSettings {
    const instance = this.primaryInstanceOf(type);

    return this.getSettings<SpecificSettings>(instance?.id ?? type);
  }

  getSettings<SpecificSettings extends object = Record<string, unknown>>(
    widgetId: string
  ): BaseUserSettings & SpecificSettings {
    const widget = this.getWidget(widgetId);

    // A copy asks by its own id, so the shipped defaults are found through its
    // type; a caller naming a type directly still lands on the right record,
    // since the original copy's id is its type.
    const type = widget ? widget.type : widgetTypeFromId(widgetId);
    const defaultSettings = DEFAULT_WIDGET_BY_ID.get(type)?.userSettings as
      | (BaseUserSettings & SpecificSettings)
      | undefined;

    return (
      (widget?.userSettings as unknown as BaseUserSettings &
        SpecificSettings) ?? defaultSettings
    );
  }
}

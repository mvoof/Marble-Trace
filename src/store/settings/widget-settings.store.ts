import { makeAutoObservable, runInAction } from 'mobx';
import { mergeWithDefaults } from '@utils/deep-merge';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from '@store/widget-defaults';
import { resolveMonitorByName } from '@store/sync/overlay-resolution';

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
  RadarSettings,
  SessionContext,
} from '@/types/widget-settings';
import { emit } from '@tauri-apps/api/event';
import { DEFAULT_LAYOUT_RESOLUTION } from '@utils/widget/layout-resolution';
import { cloneBackgroundImage } from '@utils/widget/layout-background';
import {
  monitorForWidget,
  monitorsBounds,
  placeWidgetOnMonitor,
  widgetsOnMonitor,
} from '@utils/widget/virtual-desktop';
import type { RootStore } from '@store/root-store';

const DEFAULT_LAYOUT_NAME = 'Default';

// Diagonal offset applied when a freshly added widget would land on top of one
// that is already centred on the same screen.
const WIDGET_CASCADE_STEP = 40;

/** A widget offered by the overlay's F9 "add widget" picker. */
export interface PickableWidget {
  id: string;
  label: string;
  description?: string;
  available: boolean;
  /** Monitor it currently lives on, or null when it isn't in the layout yet. */
  currentMonitorName: string | null;
}

interface LegacyMonitorConfig {
  resolution: LayoutResolution;
  widgets: WidgetDefaultConfig[];
}

/**
 * Brings persisted layouts up to the virtual-desktop format: one flat widget
 * list in desktop coordinates plus the monitors the layout covers.
 *
 * Two older shapes exist — `targetResolution` + `widgets`, and per-monitor
 * `monitorConfigs`. Both held widget coordinates relative to a single screen.
 * Converting them properly needs each monitor's real desktop position, which
 * only the OS can give, so screens are laid out side by side here and moved
 * into place by `alignMonitorsToHardware` once the monitor list has been read.
 */
const migrateLayout = (saved: unknown): SavedLayout => {
  const raw = saved as Record<string, unknown>;

  if (Array.isArray(raw['monitors'])) {
    return raw as unknown as SavedLayout;
  }

  const base = {
    id: raw['id'] as string,
    name: raw['name'] as string,
    createdAt: raw['createdAt'] as number,
  };

  const legacyBackground = raw['backgroundImage'] as string | undefined;
  const legacyConfigs = raw['monitorConfigs'] as
    | Record<string, LegacyMonitorConfig>
    | undefined;

  if (legacyConfigs) {
    const monitors: LayoutMonitor[] = [];
    const widgets: WidgetDefaultConfig[] = [];
    const backgroundImages: Record<string, string> = {};
    let offsetX = 0;

    for (const [name, config] of Object.entries(legacyConfigs)) {
      monitors.push({
        name,
        bounds: {
          x: offsetX,
          y: 0,
          width: config.resolution.width,
          height: config.resolution.height,
        },
      });

      for (const widget of config.widgets) {
        widgets.push({
          ...widget,
          userSettings: {
            ...widget.userSettings,
            x: widget.userSettings.x + offsetX,
          },
        });
      }

      if (legacyBackground) {
        backgroundImages[name] = legacyBackground;
      }

      offsetX += config.resolution.width;
    }

    return { ...base, monitors, widgets, backgroundImages };
  }

  const targetResolution = raw['targetResolution'] as
    | LayoutResolution
    | undefined;
  const monitorName = raw['targetMonitorName'] as string | undefined;

  return {
    ...base,
    monitors:
      targetResolution && monitorName
        ? [
            {
              name: monitorName,
              bounds: {
                x: 0,
                y: 0,
                width: targetResolution.width,
                height: targetResolution.height,
              },
            },
          ]
        : [],
    widgets: (raw['widgets'] as WidgetDefaultConfig[]) ?? [],
    backgroundImages:
      legacyBackground && monitorName
        ? { [monitorName]: legacyBackground }
        : {},
  };
};

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

export class WidgetSettingsStore {
  // Live working copy of the ACTIVE layout. The overlay renders this; the layout
  // editor and F9 drag mode edit this.
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  undoStack: WidgetDefaultConfig[][] = [];
  redoStack: WidgetDefaultConfig[][] = [];

  // Global widget defaults — the template edited in the Widgets catalog. Never
  // rendered on the overlay; copied into a layout when a new layout is created.
  // Kept fully independent from `widgets` so editing one never affects the other.
  defaultWidgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  // Bumped on every defaults mutation so the Widgets-catalog preview can react
  // without coupling to the live-layout changeToken.
  defaultsChangeToken = 0;

  layouts: SavedLayout[] = [];
  activeLayoutId: string | null = null;

  // Monitors physically attached right now, refreshed by the arrangement
  // watcher. The editor offers these as screens a layout can be spread onto.
  attachedMonitors: LayoutMonitor[] = [];

  // Set in an overlay window to the monitor that window covers. Null in the
  // main window, which edits one monitor at a time via activeMonitorName.
  ownMonitorName: string | null = null;

  sessionLayouts: Record<SessionContext, string | null> = {
    Practice: null,
    Qualify: null,
    Race: null,
    Garage: null,
  };

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

  constructor(private readonly root?: RootStore) {
    makeAutoObservable(
      this,
      {},
      {
        autoBind: true,
      }
    );
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
    this.sessionLayouts[context] = layoutId;
    this.bumpMutation();
  }

  setSessionLayouts(layouts: Partial<Record<SessionContext, string | null>>) {
    this.sessionLayouts = {
      Practice: null,
      Qualify: null,
      Race: null,
      Garage: null,
      ...layouts,
    };
    this.bumpMutation();
  }

  pushUndo() {
    const snapshot = this.snapshotWidgets();

    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];

      if (JSON.stringify(last) === JSON.stringify(snapshot)) {
        return;
      }
    }

    this.undoStack.push(snapshot);

    if (this.undoStack.length > 10) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const previous = this.undoStack.pop()!;

    this.redoStack.push(this.snapshotWidgets());
    this.setWidgets(previous);
    this.commitActiveLayout();
    this.bumpMutation();
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const next = this.redoStack.pop()!;

    this.undoStack.push(this.snapshotWidgets());
    this.setWidgets(next);
    this.commitActiveLayout();
    this.bumpMutation();
  }

  bringToFront(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    let maxZ = 0;

    for (const w of this.widgets.values()) {
      if (w.id !== id) {
        const z = w.userSettings.zIndex ?? 0;

        if (z > maxZ) maxZ = z;
      }
    }

    widget.userSettings.zIndex = maxZ + 1;
    this.bumpMutation();
  }

  sendToBack(id: string) {
    const widget = this.getWidget(id);

    if (!widget) return;

    this.pushUndo();

    let minZ = 0;

    for (const w of this.widgets.values()) {
      if (w.id !== id) {
        const z = w.userSettings.zIndex ?? 0;

        if (z < minZ) minZ = z;
      }
    }

    widget.userSettings.zIndex = minZ - 1;
    this.bumpMutation();
  }

  async cloneLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    const newId = crypto.randomUUID();
    const name = `${layout.name} (Copy)`;

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
      name,
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
      this.bumpMutation();
    });

    return newId;
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
        } else {
          this.widgets.set(
            defaultWidget.id,
            savedWidget
              ? {
                  ...mergeWithDefaults(defaultWidget, savedWidget),
                  userSettings: mergedUserSettings,
                }
              : { ...defaultWidget, userSettings: mergedUserSettings }
          );
        }
      });

      this.bumpMutation();

      const fuel = this.widgets.get('fuel');

      if (fuel) {
        const settings = fuel.userSettings as unknown as FuelWidgetSettings;

        void invoke('set_pit_warning_laps', {
          laps: settings.pitWarningLaps,
        }).catch((error) => {
          console.error(
            'Failed to initialize pit warning laps on backend:',
            error
          );
        });

        void invoke('set_fuel_avg_window', {
          window: settings.fuelAvgWindow,
        }).catch((error) => {
          console.error(
            'Failed to initialize fuel average window on backend:',
            error
          );
        });
      }

      const radar =
        this.widgets.get('proximity-radar') ?? this.widgets.get('radar-bar');

      if (radar) {
        const settings = radar.userSettings as unknown as RadarSettings;
        const carLength = settings.carLength ?? 4.4;

        void invoke('set_car_length', {
          length: carLength,
        }).catch((error) => {
          console.error('Failed to initialize car length on backend:', error);
        });
      }
    });
  }

  applySettingsSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (!existing) continue;

        Object.assign(existing.userSettings, incoming.userSettings);
        existing.designWidth = incoming.designWidth;
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
    const monitors = this.activeLayout?.monitors ?? [];
    const available = new Set(this.availableWidgetIds);

    const drawnHere = new Set(
      widgetsOnMonitor(this.enabledWidgets, monitorName, monitors).map(
        (widget) => widget.id
      )
    );

    return this.allWidgets
      .filter((widget) => !drawnHere.has(widget.id))
      .map((widget) => ({
        id: widget.id,
        label: widget.label,
        description: widget.description,
        available: available.has(widget.id),
        currentMonitorName: widget.userSettings.enabled
          ? (monitorForWidget(widget, monitors)?.name ?? null)
          : null,
      }))
      .sort((first, second) => first.label.localeCompare(second.label));
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

    const { bounds } = monitor;
    const { currentWidth, currentHeight } = widget.userSettings;

    const occupied = widgetsOnMonitor(
      this.enabledWidgets,
      monitorName,
      this.activeLayout?.monitors ?? []
    ).filter((placed) => placed.id !== id);

    let x = Math.round(bounds.x + (bounds.width - currentWidth) / 2);
    let y = Math.round(bounds.y + (bounds.height - currentHeight) / 2);

    // Cascade off anything already sitting in the middle so repeated adds don't
    // stack into one indistinguishable pile.
    while (
      occupied.some(
        (placed) =>
          Math.abs(placed.userSettings.x - x) < WIDGET_CASCADE_STEP &&
          Math.abs(placed.userSettings.y - y) < WIDGET_CASCADE_STEP
      )
    ) {
      x += WIDGET_CASCADE_STEP;
      y += WIDGET_CASCADE_STEP;
    }

    const maxX = Math.max(bounds.x, bounds.x + bounds.width - currentWidth);
    const maxY = Math.max(bounds.y, bounds.y + bounds.height - currentHeight);

    let maxZ = 0;

    for (const other of this.widgets.values()) {
      if (other.id === id) continue;

      const zIndex = other.userSettings.zIndex ?? 0;

      if (zIndex > maxZ) maxZ = zIndex;
    }

    widget.userSettings.x = Math.min(Math.max(x, bounds.x), maxX);
    widget.userSettings.y = Math.min(Math.max(y, bounds.y), maxY);
    widget.userSettings.zIndex = maxZ + 1;
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

    this.handleLayoutResize(id, widget, prevSettings, widget.userSettings);

    this.bumpMutation();

    if (id === 'fuel' && 'pitWarningLaps' in resolvedPartial) {
      void invoke('set_pit_warning_laps', {
        laps: (resolvedPartial as FuelWidgetSettings).pitWarningLaps,
      }).catch((error) =>
        console.error('Failed to update pit warning laps:', error)
      );
    }

    if (id === 'fuel' && 'fuelAvgWindow' in resolvedPartial) {
      void invoke('set_fuel_avg_window', {
        window: (resolvedPartial as FuelWidgetSettings).fuelAvgWindow,
      }).catch((error) =>
        console.error('Failed to update fuel average window:', error)
      );
    }

    if (
      (id === 'proximity-radar' || id === 'radar-bar') &&
      'carLength' in resolvedPartial &&
      resolvedPartial.carLength !== undefined
    ) {
      const otherId =
        id === 'proximity-radar' ? 'radar-bar' : 'proximity-radar';

      const otherWidget = this.getWidget(otherId);

      if (otherWidget) {
        const otherSettings =
          otherWidget.userSettings as unknown as RadarSettings;

        if (otherSettings.carLength !== resolvedPartial.carLength) {
          otherSettings.carLength = resolvedPartial.carLength;
        }
      }

      void invoke('set_car_length', {
        length: resolvedPartial.carLength,
      }).catch((error) =>
        console.error('Failed to update car length on backend:', error)
      );
    }
  }

  private handleLayoutResize(
    id: string,
    widget: WidgetDefaultConfig,
    prevSettings: WidgetUserSettings,
    newSettings: WidgetUserSettings
  ) {
    const config = WIDGET_BY_ID.get(id);
    const resolver = config?.resolveLayoutChange;

    if (!resolver) return;

    const result = resolver(prevSettings, newSettings, {
      designWidth: widget.designWidth,
      designHeight: widget.designHeight,
      currentWidth: widget.userSettings.currentWidth,
      currentHeight: widget.userSettings.currentHeight,
    });

    if (!result) return;

    if (result.designWidth !== undefined) {
      widget.designWidth = result.designWidth;
    }

    if (result.designHeight !== undefined) {
      widget.designHeight = result.designHeight;
    }

    if (result.currentWidth !== undefined) {
      widget.userSettings.currentWidth = result.currentWidth;
    }

    if (result.currentHeight !== undefined) {
      widget.userSettings.currentHeight = result.currentHeight;
    }

    if (result.userSettingsPatch) {
      Object.assign(widget.userSettings, result.userSettingsPatch);
    }
  }

  // ── Global defaults (edited in the Widgets catalog) ──────────────────────
  // These mirror the live-widget API but operate on `defaultWidgets` and never
  // touch the overlay (no backend invokes). They drive the "what a widget looks
  // like before it's placed in a layout" template.

  getDefaultWidget(id: string): WidgetDefaultConfig | undefined {
    return this.defaultWidgets.get(id);
  }

  getDefaultSettings<SpecificSettings extends WidgetSpecificSettings>(
    id: string
  ): BaseUserSettings & SpecificSettings {
    const widget = this.defaultWidgets.get(id);

    const fallback = DEFAULT_WIDGETS.find(
      (defaultWidget) => defaultWidget.id === id
    )?.userSettings as (BaseUserSettings & SpecificSettings) | undefined;

    return (
      (widget?.userSettings as unknown as BaseUserSettings &
        SpecificSettings) ?? fallback
    );
  }

  updateDefaultUserSettings(id: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.defaultWidgets.get(id);

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

    this.handleLayoutResize(id, widget, prevSettings, widget.userSettings);

    this.defaultsChangeToken++;
  }

  setDefaultWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((defaultWidget) => {
        const saved = widgets.find((widget) => widget.id === defaultWidget.id);

        const mergedUserSettings = saved
          ? mergeWithDefaults(
              defaultWidget.userSettings,
              saved.userSettings ?? {}
            )
          : { ...defaultWidget.userSettings };

        const existing = this.defaultWidgets.get(defaultWidget.id);

        if (existing) {
          Object.assign(existing.userSettings, mergedUserSettings);

          if (saved) {
            const merged = mergeWithDefaults(defaultWidget, saved);
            existing.designWidth = merged.designWidth;
            existing.designHeight = merged.designHeight;
          }
        } else {
          this.defaultWidgets.set(defaultWidget.id, {
            ...defaultWidget,
            userSettings: mergedUserSettings,
          });
        }
      });

      this.defaultsChangeToken++;
    });
  }

  private snapshotDefaults(): WidgetDefaultConfig[] {
    return Array.from(this.defaultWidgets.values()).map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));
  }

  setOverlayResolution(resolution: LayoutResolution) {
    this.overlayResolution = { ...resolution };
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

    if (this.activeLayout) {
      this.setWidgets(this.activeLayout.widgets);
    }

    this.bumpMutation();
  }

  /** Rectangle covering every monitor of the active layout. */
  get desktopBounds() {
    return monitorsBounds(this.activeLayout?.monitors ?? []);
  }

  // Monitors the active layout covers, empty ones included.
  get activeMonitorNames(): string[] {
    return (this.activeLayout?.monitors ?? []).map((monitor) => monitor.name);
  }

  monitorByName(monitorName: string): LayoutMonitor | undefined {
    return this.activeLayout?.monitors.find(
      (monitor) => monitor.name === monitorName
    );
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

    layout.monitors = monitors.map((monitor) => ({
      name: monitor.name,
      bounds: { ...monitor.bounds },
    }));
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
          widgetsOnMonitor(enabled, monitor.name, monitors).length > 0
      )
      .map((monitor) => monitor.name);
  }

  // Adds a monitor to the layout, extending the area widgets can be dragged
  // onto. Existing widgets are untouched — the new screen starts empty.
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
    this.bumpMutation();
  }

  // Drops a monitor from the layout. Its overlay window closes on the next
  // window sync, and the widgets that lived on it move to the first remaining
  // monitor rather than being deleted — losing them to a mis-click would be
  // unrecoverable.
  removeMonitor(layoutId: string, monitorName: string) {
    const layout = this.layouts.find((candidate) => candidate.id === layoutId);
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

    if (layout.id === this.activeLayoutId) {
      this.setWidgets(layout.widgets);
    }

    this.bumpMutation();
  }

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
    this.bumpMutation();
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
    this.layouts = layouts.map((layout) => migrateLayout(layout));

    if (activeLayoutId !== undefined) {
      this.activeLayoutId = activeLayoutId;
    }

    const resolvedId = activeLayoutId ?? this.activeLayoutId;
    const activeLayout = this.layouts.find(
      (layout) => layout.id === resolvedId
    );

    if (activeLayout) {
      this.setWidgets(activeLayout.widgets);
    }
  }

  // Guarantees there is always an active layout. Creates a "Default" layout on
  // first run, anchored to the primary monitor — a layout with no monitor gets
  // no overlay window and no area to place widgets on.
  ensureDefaultLayout() {
    if (this.layouts.length > 0) {
      if (!this.activeLayoutId) {
        this.activeLayoutId = this.layouts[0].id;
      }

      return;
    }

    const id = crypto.randomUUID();

    this.layouts = [
      {
        id,
        name: DEFAULT_LAYOUT_NAME,
        createdAt: Date.now(),
        monitors: [],
        widgets: [],
        backgroundImages: {},
      },
    ];

    this.activeLayoutId = id;
    this.sessionLayouts = {
      Practice: id,
      Qualify: id,
      Race: id,
      Garage: null,
    };

    void resolveMonitorByName(null).then((monitor) => {
      if (!monitor) return;

      runInAction(() => {
        const target = this.layouts.find((candidate) => candidate.id === id);

        if (!target || target.monitors.length > 0) return;

        this.overlayResolution = { ...monitor.resolution };

        target.monitors = [
          {
            name: monitor.name,
            bounds: {
              x: 0,
              y: 0,
              width: monitor.resolution.width,
              height: monitor.resolution.height,
            },
          },
        ];
        target.widgets = this.buildStarterWidgets();

        this.setWidgets(target.widgets);
        this.bumpMutation();
      });
    });
  }

  // Curated onboarding layout: the default-enabled starter widgets placed at
  // sensible anchors for the current overlay resolution (standings top-left,
  // relative bottom-left, radar bottom-center) instead of the raw default
  // positions clustered in a corner.
  // When clean is true, it returns all widgets disabled.
  private buildStarterWidgets(clean: boolean = false): WidgetDefaultConfig[] {
    const widgets = this.snapshotDefaults();

    if (clean) {
      for (const widget of widgets) {
        widget.userSettings.enabled = false;
      }

      return widgets;
    }

    const { width, height } = this.overlayResolution;
    const MARGIN = 24;

    const place = (id: string, x: number, y: number) => {
      const widget = widgets.find((candidate) => candidate.id === id);

      if (widget) {
        widget.userSettings.x = Math.round(x);
        widget.userSettings.y = Math.round(y);
      }
    };

    const heightOf = (id: string) =>
      widgets.find((candidate) => candidate.id === id)?.userSettings
        .currentHeight ?? 0;
    const widthOf = (id: string) =>
      widgets.find((candidate) => candidate.id === id)?.userSettings
        .currentWidth ?? 0;

    place('standings', MARGIN, MARGIN);
    place('relative', MARGIN, height - heightOf('relative') - MARGIN);
    place(
      'proximity-radar',
      (width - widthOf('proximity-radar')) / 2,
      height - heightOf('proximity-radar') - MARGIN
    );

    return widgets;
  }

  saveLayout(name: string) {
    const id = crypto.randomUUID();

    const layout: SavedLayout = {
      id,
      name: name.trim(),
      createdAt: Date.now(),
      monitors: [],
      widgets: [],
      backgroundImages: {},
    };

    this.layouts = [...this.layouts, layout];
    this.activeLayoutId = id;
    this.setWidgets(this.buildStarterWidgets(true));
    this.bumpMutation();

    void resolveMonitorByName(null).then((monitor) => {
      if (!monitor) return;

      runInAction(() => {
        const targetLayout = this.layouts.find(
          (candidate) => candidate.id === id
        );

        if (!targetLayout || targetLayout.monitors.length > 0) return;

        targetLayout.monitors = [
          {
            name: monitor.name,
            bounds: {
              x: 0,
              y: 0,
              width: monitor.resolution.width,
              height: monitor.resolution.height,
            },
          },
        ];
        targetLayout.widgets = this.buildStarterWidgets(true);

        if (this.activeLayoutId === id) {
          this.overlayResolution = { ...monitor.resolution };
        }

        this.bumpMutation();
      });
    });
  }

  get activeLayout(): SavedLayout | undefined {
    return this.layouts.find((layout) => layout.id === this.activeLayoutId);
  }

  // Background image shown behind widgets in the layout editor (e.g. a cockpit
  // view) so widgets can be placed relative to a virtual cockpit. Stored on the
  // layout; undefined clears it.
  setActiveLayoutBackground(image: string | undefined) {
    const layout = this.activeLayout;

    if (!layout) return;

    // Layout-wide background is gone: each monitor carries its own image.
    // Kept as a convenience that paints every monitor of the layout.
    for (const monitor of layout.monitors) {
      this.setMonitorBackground(monitor.name, image);
    }
  }

  // Selecting a layout loads its saved widgets into the live store. Repointing
  // activeLayoutId alone would let the commit reaction clobber the selected
  // layout with the previously-active layout's stale widgets.
  selectLayout(id: string | null) {
    if (id) {
      this.loadLayout(id);

      return;
    }

    this.activeLayoutId = null;
    this.bumpMutation();
  }

  // Load a layout into the editor without pushing it to the overlay.
  // The overlay keeps showing whatever was active before. Use activateEditorLayout()
  // or loadLayout() to make the overlay reflect the change.
  switchEditorLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    this.editorPreviewMode = true;
    this.activeLayoutId = id;

    this.setWidgets(layout.widgets);

    this.bumpMutation();
  }

  // Make the layout currently shown in the editor the active one in the overlay.
  activateEditorLayout() {
    this.editorPreviewMode = false;
    this.bumpMutation();
  }

  loadLayout(id: string, options?: { notify?: boolean }) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    this.editorPreviewMode = false;
    this.activeLayoutId = id;

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
      void emit('layout-activated', layout.name);
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
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout || layout.monitors.length === 0) return;

    layout.widgets = this.snapshotWidgets();
    this.bumpMutation();
  }

  deleteLayout(id: string) {
    this.layouts = this.layouts.filter((savedLayout) => savedLayout.id !== id);

    if (this.activeLayoutId !== id) {
      this.bumpMutation();

      return;
    }

    const fallbackId = this.layouts[0]?.id ?? null;

    // Load the fallback's saved widgets into the live store BEFORE bumping the
    // mutation so the commit reaction doesn't clobber the fallback.
    if (fallbackId) {
      this.loadLayout(fallbackId);

      return;
    }

    this.activeLayoutId = null;
    this.bumpMutation();
  }

  renameLayout(id: string, name: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    layout.name = name.trim();
    this.bumpMutation();
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

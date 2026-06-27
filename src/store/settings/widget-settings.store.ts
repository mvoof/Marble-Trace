import { makeAutoObservable, runInAction } from 'mobx';
import { filterToDefaults } from '@utils/filter-to-defaults';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from '@store/widget-defaults';
import { resolveMonitorByName } from '@store/sync/overlay-resolution';

import type {
  WidgetDefaultConfig,
  BaseUserSettings,
  FuelWidgetSettings,
  LayoutResolution,
  MonitorConfig,
  SavedLayout,
  StandingsViewMode,
  StandingsWidgetSettings,
  WidgetSpecificSettings,
  WidgetUserSettings,
  RadarSettings,
} from '@/types/widget-settings';
import {
  DEFAULT_LAYOUT_RESOLUTION,
  scaleWidgetsToResolution,
} from '@utils/widget/layout-resolution';
import { cloneBackgroundImage } from '@utils/widget/layout-background';
import type { RootStore } from '@store/root-store';

const DEFAULT_LAYOUT_NAME = 'Default';

// Converts persisted layouts from the old format (targetResolution + widgets[])
// to the new per-monitor config format. Safe to call on already-migrated data.
const migrateLayout = (saved: unknown): SavedLayout => {
  const raw = saved as Record<string, unknown>;

  if ('monitorConfigs' in raw && !('widgets' in raw)) {
    return raw as unknown as SavedLayout;
  }

  const monitorName = (raw['targetMonitorName'] as string | undefined) ?? null;
  const targetResolution = raw['targetResolution'] as
    | LayoutResolution
    | undefined;
  const widgets = raw['widgets'] as WidgetDefaultConfig[] | undefined;
  const configs: Record<string, MonitorConfig> = {};
  const configKey = monitorName ?? '__legacy__';

  if (targetResolution && widgets) {
    configs[configKey] = { resolution: targetResolution, widgets };
  }

  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    createdAt: raw['createdAt'] as number,
    backgroundImage: raw['backgroundImage'] as string | undefined,
    monitorConfigs: configs,
    activeMonitorName: Object.keys(configs).length > 0 ? configKey : null,
  };
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

    let clonedBg: string | undefined = undefined;

    if (layout.backgroundImage) {
      clonedBg = await cloneBackgroundImage(
        layout.backgroundImage,
        newId
      ).catch((err) => {
        console.error('Failed to clone background image:', err);
        return undefined;
      });
    }

    const monitorConfigs: Record<string, MonitorConfig> = {};

    for (const [key, config] of Object.entries(layout.monitorConfigs)) {
      monitorConfigs[key] = {
        resolution: { ...config.resolution },
        widgets: config.widgets.map((w) => ({
          ...w,
          userSettings: { ...w.userSettings },
        })),
      };
    }

    const cloned: SavedLayout = {
      id: newId,
      name,
      createdAt: Date.now(),
      backgroundImage: clonedBg,
      monitorConfigs,
      activeMonitorName: layout.activeMonitorName,
    };

    runInAction(() => {
      this.layouts = [...this.layouts, cloned];
      this.activeLayoutId = newId;
      this.setWidgets(
        layout.activeMonitorName && monitorConfigs[layout.activeMonitorName]
          ? monitorConfigs[layout.activeMonitorName].widgets
          : this.buildStarterWidgets(true)
      );
      this.bumpMutation();
    });
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
          ? filterToDefaults(
              defaultWidget.userSettings,
              savedWidget.userSettings ?? {}
            )
          : { ...defaultWidget.userSettings };

        const existing = this.widgets.get(defaultWidget.id);

        if (existing) {
          Object.assign(existing.userSettings, mergedUserSettings);

          if (savedWidget) {
            const merged = filterToDefaults(defaultWidget, savedWidget);
            existing.designWidth = merged.designWidth;
            existing.designHeight = merged.designHeight;
          }
        } else {
          this.widgets.set(
            defaultWidget.id,
            savedWidget
              ? {
                  ...filterToDefaults(defaultWidget, savedWidget),
                  userSettings: mergedUserSettings,
                }
              : { ...defaultWidget, userSettings: mergedUserSettings }
          );
        }
      });

      this.bumpMutation();

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
          ? filterToDefaults(
              defaultWidget.userSettings,
              saved.userSettings ?? {}
            )
          : { ...defaultWidget.userSettings };

        const existing = this.defaultWidgets.get(defaultWidget.id);

        if (existing) {
          Object.assign(existing.userSettings, mergedUserSettings);

          if (saved) {
            const merged = filterToDefaults(defaultWidget, saved);
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

  // Switches the active layout to a different monitor config. Saves the current
  // live widgets into the previous config, then loads (or creates) the new one.
  // resolution is the logical px size of the target monitor, needed to create a
  // new config when the monitor hasn't been configured before.
  selectMonitorForActiveLayout(
    monitorName: string,
    resolution: LayoutResolution
  ) {
    const layout = this.activeLayout;

    if (!layout) return;

    if (
      layout.activeMonitorName &&
      layout.monitorConfigs[layout.activeMonitorName]
    ) {
      layout.monitorConfigs[layout.activeMonitorName].widgets =
        this.snapshotWidgets();
    }

    layout.activeMonitorName = monitorName;

    if (layout.monitorConfigs[monitorName]) {
      const config = layout.monitorConfigs[monitorName];

      this.overlayResolution = { ...config.resolution };
      this.setWidgets(config.widgets);
    } else {
      const scaledWidgets = scaleWidgetsToResolution(
        this.allWidgets,
        this.overlayResolution,
        resolution
      );

      layout.monitorConfigs[monitorName] = {
        resolution: { ...resolution },
        widgets: scaledWidgets,
      };
      this.overlayResolution = { ...resolution };
      this.setWidgets(scaledWidgets);
    }

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
    const config = activeLayout?.activeMonitorName
      ? activeLayout.monitorConfigs[activeLayout.activeMonitorName]
      : undefined;

    if (config) {
      this.overlayResolution = { ...config.resolution };
    }
  }

  // Guarantees there is always an active layout. Creates a "Default" layout on
  // first run. The layout starts without monitor configs — the user selects a
  // monitor in the layout editor to configure one.
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
        monitorConfigs: {},
        activeMonitorName: null,
      },
    ];

    this.activeLayoutId = id;
    this.setWidgets(this.buildStarterWidgets());
    this.bumpMutation();
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
      monitorConfigs: {},
      activeMonitorName: null,
    };

    this.layouts = [...this.layouts, layout];
    this.activeLayoutId = id;
    this.setWidgets(this.buildStarterWidgets(true));
    this.bumpMutation();

    void resolveMonitorByName(null).then((monitor) => {
      if (monitor) {
        runInAction(() => {
          const targetLayout = this.layouts.find(
            (candidate) => candidate.id === id
          );

          if (targetLayout) {
            targetLayout.monitorConfigs[monitor.name] = {
              resolution: { ...monitor.resolution },
              widgets: this.buildStarterWidgets(true),
            };

            targetLayout.activeMonitorName = monitor.name;

            if (this.activeLayoutId === id) {
              this.overlayResolution = { ...monitor.resolution };
            }

            this.bumpMutation();
          }
        });
      }
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

    layout.backgroundImage = image;
    this.bumpMutation();
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

  loadLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    this.activeLayoutId = id;

    const config = layout.activeMonitorName
      ? layout.monitorConfigs[layout.activeMonitorName]
      : undefined;

    if (config) {
      this.overlayResolution = { ...config.resolution };
      this.setWidgets(config.widgets);
    }

    this.bumpMutation();
  }

  // Auto-commit: writes the live widgets back into the active monitor config.
  // Skipped when no monitor is selected for the layout.
  commitActiveLayout() {
    const layout = this.activeLayout;

    if (!layout?.activeMonitorName) return;

    const config = layout.monitorConfigs[layout.activeMonitorName];

    if (!config) return;

    config.widgets = this.snapshotWidgets();
  }

  updateLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout?.activeMonitorName) return;

    const config = layout.monitorConfigs[layout.activeMonitorName];

    if (config) {
      config.widgets = this.snapshotWidgets();
    }

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

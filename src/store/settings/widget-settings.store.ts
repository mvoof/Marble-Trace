import { makeAutoObservable, runInAction } from 'mobx';
import { filterToDefaults } from '@utils/filter-to-defaults';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from '@store/widget-defaults';

import type {
  WidgetDefaultConfig,
  BaseUserSettings,
  FuelWidgetSettings,
  LayoutResolution,
  SavedLayout,
  StandingsViewMode,
  StandingsWidgetSettings,
  WidgetSpecificSettings,
  WidgetUserSettings,
  RadarSettings,
} from '@/types/widget-settings';
import {
  DEFAULT_LAYOUT_RESOLUTION,
  resolutionsEqual,
  scaleWidgetsToResolution,
} from '@utils/widget/layout-resolution';
import type { RootStore } from '@store/root-store';

const DEFAULT_LAYOUT_NAME = 'Default';

export class WidgetSettingsStore {
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig },
    ])
  );

  layouts: SavedLayout[] = [];
  activeLayoutId: string | null = null;

  // Resolution of the overlay window the layouts are placed against. Populated
  // from the selected monitor during sync; defaults until then.
  overlayResolution: LayoutResolution = { ...DEFAULT_LAYOUT_RESOLUTION };
  overlayMonitorName: string | undefined = undefined;

  // Set when the active layout was authored against a different resolution than
  // the current overlay. Drives the "adapt & save copy" banner. null = match.
  activeLayoutResolutionMismatch: LayoutResolution | null = null;

  // Incremented on every settings mutation. Reactions use this as a cheap
  // change trigger instead of subscribing to every field across all widgets.
  changeToken = 0;

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

    return ids;
  }

  cycleStandingsViewMode() {
    const settings = this.getSettings<StandingsWidgetSettings>('standings');
    const order: StandingsViewMode[] = ['all', 'grouped', 'cycling'];
    const currentIdx = order.indexOf(settings.viewMode);
    const nextIdx = (currentIdx + 1) % order.length;

    this.updateUserSettings('standings', {
      ...settings,
      viewMode: order[nextIdx],
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
    });
  }

  applyLayoutSync(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      for (const incoming of widgets) {
        const existing = this.widgets.get(incoming.id);

        if (!existing) continue;

        const { x, y, currentWidth, currentHeight } = incoming.userSettings;
        Object.assign(existing.userSettings, {
          x,
          y,
          currentWidth,
          currentHeight,
        });
      }
    });
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    return this.widgets.get(id);
  }

  setWidgetEnabled(id: string, enabled: boolean) {
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

    this.handleLayoutResize(id, prevSettings, widget.userSettings);

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
    prevSettings: WidgetUserSettings,
    newSettings: WidgetUserSettings
  ) {
    const widget = this.getWidget(id);

    if (!widget) return;

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

  setOverlayResolution(resolution: LayoutResolution, monitorName?: string) {
    this.overlayResolution = { ...resolution };
    this.overlayMonitorName = monitorName;

    this.refreshActiveLayoutMismatch();
  }

  private refreshActiveLayoutMismatch() {
    const active = this.layouts.find(
      (layout) => layout.id === this.activeLayoutId
    );

    this.activeLayoutResolutionMismatch =
      active &&
      !resolutionsEqual(active.targetResolution, this.overlayResolution)
        ? { ...active.targetResolution }
        : null;
  }

  private snapshotWidgets(): WidgetDefaultConfig[] {
    return this.allWidgets.map((widget) => ({
      ...widget,
      userSettings: structuredClone(widget.userSettings),
    }));
  }

  setLayouts(layouts: SavedLayout[], activeLayoutId?: string | null) {
    this.layouts = layouts.map((layout) => ({
      ...layout,
      targetResolution: layout.targetResolution ?? {
        ...this.overlayResolution,
      },
    }));

    if (activeLayoutId !== undefined) {
      this.activeLayoutId = activeLayoutId;
    }

    this.refreshActiveLayoutMismatch();
  }

  // Guarantees there is always an active layout. Creates a "Default" layout from
  // the current widgets on first run so the overlay is never in a layout-less
  // state.
  ensureDefaultLayout() {
    if (this.layouts.length > 0) {
      if (!this.activeLayoutId) {
        this.activeLayoutId = this.layouts[0].id;
        this.refreshActiveLayoutMismatch();
      }

      return;
    }

    const id = crypto.randomUUID();

    this.layouts = [
      {
        id,
        name: DEFAULT_LAYOUT_NAME,
        createdAt: Date.now(),
        targetResolution: { ...this.overlayResolution },
        targetMonitorName: this.overlayMonitorName,
        widgets: this.snapshotWidgets(),
      },
    ];

    this.activeLayoutId = id;
    this.refreshActiveLayoutMismatch();
    this.bumpMutation();
  }

  saveLayout(name: string) {
    const id = crypto.randomUUID();

    const layout: SavedLayout = {
      id,
      name: name.trim(),
      createdAt: Date.now(),
      targetResolution: { ...this.overlayResolution },
      targetMonitorName: this.overlayMonitorName,
      widgets: this.snapshotWidgets(),
    };

    this.layouts = [...this.layouts, layout];
    this.activeLayoutId = id;
    this.refreshActiveLayoutMismatch();
    this.bumpMutation();
  }

  selectLayout(id: string | null) {
    this.activeLayoutId = id;
    this.refreshActiveLayoutMismatch();
    this.bumpMutation();
  }

  loadLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    const widgets = scaleWidgetsToResolution(
      layout.widgets,
      layout.targetResolution,
      this.overlayResolution
    );

    this.setWidgets(widgets);
    this.activeLayoutId = id;
    this.refreshActiveLayoutMismatch();
    this.bumpMutation();
  }

  // Auto-commit: writes the live widgets back into the active layout. Skipped
  // when the overlay resolution differs from the layout's target, so an
  // unadapted mismatch is never silently re-stamped — the banner handles that.
  commitActiveLayout() {
    const layout = this.layouts.find(
      (savedLayout) => savedLayout.id === this.activeLayoutId
    );

    if (!layout) return;

    if (!resolutionsEqual(layout.targetResolution, this.overlayResolution)) {
      return;
    }

    layout.widgets = this.snapshotWidgets();
  }

  // Banner action: re-stamp the active layout to the current overlay resolution,
  // keeping the already-scaled widget placement.
  adaptActiveLayoutToOverlay() {
    const layout = this.layouts.find(
      (savedLayout) => savedLayout.id === this.activeLayoutId
    );

    if (!layout) return;

    layout.targetResolution = { ...this.overlayResolution };
    layout.targetMonitorName = this.overlayMonitorName;
    layout.widgets = this.snapshotWidgets();

    this.refreshActiveLayoutMismatch();
    this.bumpMutation();
  }

  updateLayout(id: string) {
    const layout = this.layouts.find((savedLayout) => savedLayout.id === id);

    if (!layout) return;

    layout.widgets = this.snapshotWidgets();

    this.bumpMutation();
  }

  deleteLayout(id: string) {
    this.layouts = this.layouts.filter((savedLayout) => savedLayout.id !== id);

    if (this.activeLayoutId === id) {
      this.activeLayoutId = this.layouts[0]?.id ?? null;
    }

    this.refreshActiveLayoutMismatch();
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

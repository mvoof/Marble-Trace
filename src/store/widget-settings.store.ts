import { makeAutoObservable, runInAction } from 'mobx';
import { filterToDefaults } from '@utils/filter-to-defaults';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_WIDGETS, WIDGET_BY_ID } from './widget-defaults';

import type {
  WidgetDefaultConfig,
  BaseUserSettings,
  FuelWidgetSettings,
  StandingsWidgetSettings,
  WidgetSpecificSettings,
  WidgetUserSettings,
  RadarSettings,
} from '@/types/widget-settings';

export class WidgetSettingsStore {
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig },
    ])
  );

  standingsActiveClassIndex = 0;

  isTrackMapForceStartPending = false;

  // Incremented on every settings mutation. Reactions use this as a cheap
  // change trigger instead of subscribing to every field across all widgets.
  changeToken = 0;

  constructor() {
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

  get enabledWidgetIds(): string[] {
    const ids: string[] = [];

    for (const widget of this.widgets.values()) {
      if (widget.userSettings.enabled) {
        ids.push(widget.id);
      }
    }

    return ids;
  }

  setTrackMapForceStartPending(pending: boolean) {
    this.isTrackMapForceStartPending = pending;
  }

  clampStandingsActiveClassIndex(totalClasses: number) {
    if (totalClasses > 0 && this.standingsActiveClassIndex >= totalClasses) {
      this.standingsActiveClassIndex = Math.max(0, totalClasses - 1);
    }
  }

  cycleStandingsPrev(totalClasses: number) {
    if (totalClasses <= 1) return;

    const clamped = Math.min(this.standingsActiveClassIndex, totalClasses - 1);

    this.standingsActiveClassIndex =
      clamped === 0 ? totalClasses - 1 : clamped - 1;
  }

  cycleStandingsNext(totalClasses: number) {
    if (totalClasses <= 1) return;
    const clamped = Math.min(this.standingsActiveClassIndex, totalClasses - 1);

    this.standingsActiveClassIndex =
      clamped === totalClasses - 1 ? 0 : clamped + 1;
  }

  toggleStandingsClassCycling() {
    const settings = this.getSettings<StandingsWidgetSettings>('standings');

    this.updateUserSettings('standings', {
      ...settings,
      enableClassCycling: !settings.enableClassCycling,
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

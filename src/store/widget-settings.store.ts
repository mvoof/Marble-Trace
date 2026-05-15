import { makeAutoObservable, runInAction } from 'mobx';
import { filterToDefaults } from '../utils/filter-to-defaults';
import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_WIDGETS,
  LAP_DELTA_DEFAULT_WIDTHS,
  LAP_TIMES_DEFAULT_WIDTHS,
  LINEAR_MAP_SIZES,
  INPUT_TRACE_SIZES,
} from './widget-defaults';

import type {
  WidgetDefaultConfig,
  FlagDisplaySettings,
  FuelWidgetSettings,
  GMeterWidgetSettings,
  InputTraceSettings,
  LinearMapWidgetSettings,
  RadarSettings,
  RelativeWidgetSettings,
  SpeedWidgetSettings,
  StandingsWidgetSettings,
  TrackMapWidgetSettings,
  WeatherWidgetSettings,
  LapTimesWidgetSettings,
  LapDeltaWidgetSettings,
  ChassisWidgetSettings,
  TimerWidgetSettings,
  WidgetSpecificSettings,
} from '../types/widget-settings';

class WidgetSettingsStore {
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig },
    ])
  );

  standingsActiveClassIndex = 0;

  isTrackMapForceStartPending = false;

  private autoSizedWidgets = new Set<string>();

  constructor() {
    makeAutoObservable(this, { autoSizedWidgets: false } as never, {
      autoBind: true,
    });
  }

  get allWidgets(): WidgetDefaultConfig[] {
    return Array.from(this.widgets.values());
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
    const settings = this.getStandingsSettings();
    this.updateWidgetSpecificSettings('standings', {
      ...settings,
      enableClassCycling: !settings.enableClassCycling,
    });
  }

  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((defaultWidget) => {
        const s = widgets.find((widget) => widget.id === defaultWidget.id);

        if (!s) {
          this.widgets.set(defaultWidget.id, { ...defaultWidget });
          return;
        }

        const defaultSpecificSettings = defaultWidget.widgetSpecificSettings;
        const savedSpecificSettings = s.widgetSpecificSettings;

        const mergedWidgetSpecificSettings: WidgetSpecificSettings | undefined =
          defaultSpecificSettings
            ? (filterToDefaults(
                defaultSpecificSettings,
                savedSpecificSettings ?? {}
              ) as WidgetSpecificSettings)
            : undefined;

        const autoSizedCurrent = this.autoSizedWidgets.has(defaultWidget.id)
          ? this.widgets.get(defaultWidget.id)
          : null;

        this.widgets.set(defaultWidget.id, {
          ...filterToDefaults(defaultWidget, s),
          widgetSpecificSettings: mergedWidgetSpecificSettings,
          ...(autoSizedCurrent && {
            currentWidth: autoSizedCurrent.currentWidth,
            currentHeight: autoSizedCurrent.currentHeight,
            designWidth: autoSizedCurrent.designWidth,
            designHeight: autoSizedCurrent.designHeight,
          }),
        });
      });
    });
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    return this.widgets.get(id);
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.updateField(id, 'enabled', enabled);
  }

  updatePosition(id: string, x: number, y: number) {
    const widget = this.getWidget(id);
    if (widget && (widget.x !== x || widget.y !== y)) {
      widget.x = x;
      widget.y = y;
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.getWidget(id);
    if (
      widget &&
      (widget.currentWidth !== width || widget.currentHeight !== height)
    ) {
      widget.currentWidth = width;
      widget.currentHeight = height;
    }
  }

  updateAutoSize(id: string, width: number, height: number) {
    this.autoSizedWidgets.add(id);
    const widget = this.getWidget(id);
    if (
      widget &&
      (widget.currentWidth !== width ||
        widget.currentHeight !== height ||
        widget.designWidth !== width ||
        widget.designHeight !== height)
    ) {
      widget.currentWidth = width;
      widget.currentHeight = height;
      widget.designWidth = width;
      widget.designHeight = height;
    }
  }

  updateField<K extends keyof WidgetDefaultConfig>(
    id: string,
    field: K,
    value: WidgetDefaultConfig[K]
  ) {
    const widget = this.getWidget(id);
    if (widget) {
      widget[field] = value;
    }
  }

  updateWidgetSpecificSettings(id: string, settings: WidgetSpecificSettings) {
    const widget = this.getWidget(id);

    if (widget) {
      const prevSettings = widget.widgetSpecificSettings;

      if (id === 'fuel' && 'barWidth' in settings && settings.barWidth !== undefined) {
        settings = {
          ...settings,
          barWidth: Math.max(5, Math.min(20, settings.barWidth)),
        } as WidgetSpecificSettings;
      }

      widget.widgetSpecificSettings = {
        ...prevSettings,
        ...settings,
      } as WidgetSpecificSettings;

      this.handleWidgetSpecificResize(id, prevSettings, settings);

      if (id === 'fuel' && 'pitWarningLaps' in settings) {
        void invoke('set_pit_warning_laps', {
          laps: (settings as FuelWidgetSettings).pitWarningLaps,
        }).catch((e) => console.error('Failed to update pit warning laps:', e));
      }
    }
  }

  private handleWidgetSpecificResize(
    id: string,
    prevSettings: WidgetSpecificSettings | undefined,
    newSettings: WidgetSpecificSettings
  ) {
    const widget = this.getWidget(id);
    if (!widget) return;

    if (id === 'relative-map' && 'orientation' in newSettings && newSettings.orientation) {
      const prevOrientation =
        prevSettings && 'orientation' in prevSettings
          ? prevSettings.orientation
          : undefined;
      const nextOrientation = newSettings.orientation;

      if (prevOrientation !== nextOrientation) {
        const size = LINEAR_MAP_SIZES[nextOrientation];

        if (size) {
          widget.designWidth = size.designWidth;
          widget.designHeight = size.designHeight;
        }

        const prevW = widget.currentWidth;
        widget.currentWidth = widget.currentHeight;
        widget.currentHeight = prevW;
      }
    }

    if (id === 'input-trace' && 'barMode' in newSettings && newSettings.barMode) {
      const prevBarMode =
        prevSettings && 'barMode' in prevSettings
          ? prevSettings.barMode
          : 'horizontal';
      const nextBarMode = newSettings.barMode;

      if (prevBarMode !== nextBarMode && nextBarMode !== 'hidden') {
        const size = INPUT_TRACE_SIZES[nextBarMode];

        if (size) {
          widget.currentWidth = size.designWidth;
          widget.currentHeight = size.designHeight;
          widget.designWidth = size.designWidth;
          widget.designHeight = size.designHeight;
        }
      }
    }

    if (
      (id === 'lap-times' || id === 'lap-delta') &&
      'layout' in newSettings &&
      newSettings.layout
    ) {
      const defaultWidths =
        id === 'lap-times' ? LAP_TIMES_DEFAULT_WIDTHS : LAP_DELTA_DEFAULT_WIDTHS;

      const prevLayout =
        prevSettings && 'layout' in prevSettings
          ? prevSettings.layout
          : 'vertical';
      const nextLayout = newSettings.layout;

      if (prevLayout !== nextLayout) {
        const prevWidths =
          prevSettings && 'layoutWidths' in prevSettings
            ? (prevSettings.layoutWidths ?? {})
            : {};
        const savedWidths = {
          ...prevWidths,
          [prevLayout]: widget.currentWidth,
        };
        const nextWidth = savedWidths[nextLayout] ?? defaultWidths[nextLayout];

        widget.widgetSpecificSettings = {
          ...widget.widgetSpecificSettings,
          ...newSettings,
          layoutWidths: savedWidths,
        } as WidgetSpecificSettings;

        widget.currentWidth = nextWidth ?? widget.currentWidth;
        widget.designWidth = widget.currentWidth;
      }
    }
  }

  private getSettings<T extends WidgetSpecificSettings>(widgetId: string): T {
    const widget = this.getWidget(widgetId);

    const defaultConfig = DEFAULT_WIDGETS.find(
      (defaultWidget) => defaultWidget.id === widgetId
    );
    const defaultSettings = defaultConfig?.widgetSpecificSettings as T;

    return (widget?.widgetSpecificSettings as T) ?? defaultSettings;
  }

  getSpeedSettings(): SpeedWidgetSettings {
    return this.getSettings<SpeedWidgetSettings>('speed');
  }

  getInputTraceSettings(): InputTraceSettings {
    return this.getSettings<InputTraceSettings>('input-trace');
  }

  getRadarSettings(id: 'proximity-radar' | 'radar-bar'): RadarSettings {
    return this.getSettings<RadarSettings>(id);
  }

  getStandingsSettings(): StandingsWidgetSettings {
    return this.getSettings<StandingsWidgetSettings>('standings');
  }

  getRelativeSettings(): RelativeWidgetSettings {
    return this.getSettings<RelativeWidgetSettings>('relative');
  }

  getTrackMapSettings(): TrackMapWidgetSettings {
    const settings = this.getSettings<TrackMapWidgetSettings>('track-map');
    const showSectors = settings.showSectors ?? true;

    return {
      ...settings,
      showSectors,
      showSectorTimes: settings.showSectorTimes ?? showSectors,
      showSectorsOnMap: settings.showSectorsOnMap ?? showSectors,
    };
  }

  getLinearMapSettings(): LinearMapWidgetSettings {
    return this.getSettings<LinearMapWidgetSettings>('relative-map');
  }

  getWeatherSettings(): WeatherWidgetSettings {
    return this.getSettings<WeatherWidgetSettings>('weather');
  }

  getFuelSettings(): FuelWidgetSettings {
    return this.getSettings<FuelWidgetSettings>('fuel');
  }

  getLapTimesSettings(): LapTimesWidgetSettings {
    const settings = this.getSettings<LapTimesWidgetSettings>('lap-times');

    return { ...settings, showPredicted: settings.showPredicted ?? true };
  }

  getChassisSettings(): ChassisWidgetSettings {
    return this.getSettings<ChassisWidgetSettings>('chassis');
  }

  getLapDeltaSettings(): LapDeltaWidgetSettings {
    return this.getSettings<LapDeltaWidgetSettings>('lap-delta');
  }

  getTimerSettings(): TimerWidgetSettings {
    return this.getSettings<TimerWidgetSettings>('timer');
  }

  getFlagDisplaySettings(id: 'led-flags' | 'flat-flags'): FlagDisplaySettings {
    return this.getSettings<FlagDisplaySettings>(id);
  }

  getGMeterSettings(): GMeterWidgetSettings {
    return this.getSettings<GMeterWidgetSettings>('g-meter');
  }
}

export const widgetSettingsStore = new WidgetSettingsStore();

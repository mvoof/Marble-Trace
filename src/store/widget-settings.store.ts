import { makeAutoObservable, runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_WIDGETS,
  LINEAR_MAP_SIZES,
  INPUT_TRACE_SIZES,
} from './widget-defaults';

import type {
  FlagDisplaySettings,
  FuelWidgetSettings,
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
  WidgetConfig,
  WidgetCustomSettings,
} from '../types/widget-settings';

class WidgetSettingsStore {
  widgets = new Map<string, WidgetConfig>(
    DEFAULT_WIDGETS.map((w) => [w.id, { ...w }])
  );

  standingsActiveClassIndex = 0;

  isTrackMapForceStartPending = false;

  private autoSizedWidgets = new Set<string>();

  constructor() {
    makeAutoObservable(this, { autoSizedWidgets: false } as never, {
      autoBind: true,
    });
  }

  get allWidgets(): WidgetConfig[] {
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
    this.updateCustomSettings('standings', {
      standings: {
        ...settings,
        enableClassCycling: !settings.enableClassCycling,
      },
    });
  }

  setWidgets(widgets: WidgetConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((def) => {
        const s = widgets.find((w) => w.id === def.id);
        if (!s) {
          this.widgets.set(def.id, { ...def });
          return;
        }

        const defCS = def.customSettings ?? {};
        const sCS = s.customSettings ?? {};

        const mergedCustomSettings: WidgetCustomSettings = { ...defCS };
        for (const key of Object.keys(sCS) as Array<
          keyof WidgetCustomSettings
        >) {
          mergedCustomSettings[key] = {
            ...defCS[key],
            ...sCS[key],
          } as never;
        }

        const autoSizedCurrent = this.autoSizedWidgets.has(def.id)
          ? this.widgets.get(def.id)
          : null;

        this.widgets.set(def.id, {
          ...def,
          ...s,
          customSettings: mergedCustomSettings,
          ...(autoSizedCurrent && {
            width: autoSizedCurrent.width,
            height: autoSizedCurrent.height,
            designWidth: autoSizedCurrent.designWidth,
            designHeight: autoSizedCurrent.designHeight,
          }),
        });
      });
    });
  }

  getWidget(id: string): WidgetConfig | undefined {
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
    if (widget && (widget.width !== width || widget.height !== height)) {
      widget.width = width;
      widget.height = height;
    }
  }

  updateAutoSize(id: string, width: number, height: number) {
    this.autoSizedWidgets.add(id);
    const widget = this.getWidget(id);
    if (
      widget &&
      (widget.width !== width ||
        widget.height !== height ||
        widget.designWidth !== width ||
        widget.designHeight !== height)
    ) {
      widget.width = width;
      widget.height = height;
      widget.designWidth = width;
      widget.designHeight = height;
    }
  }

  updateField<K extends keyof WidgetConfig>(
    id: string,
    field: K,
    value: WidgetConfig[K]
  ) {
    const widget = this.getWidget(id);
    if (widget) {
      widget[field] = value;
    }
  }

  updateCustomSettings(id: string, settings: WidgetCustomSettings) {
    const widget = this.getWidget(id);
    if (widget) {
      const prevSettings = widget.customSettings;

      widget.customSettings = {
        ...prevSettings,
        ...settings,
      };

      this.handleWidgetSpecificResize(id, prevSettings, settings);

      if (id === 'fuel' && settings.fuel && 'pitWarningLaps' in settings.fuel) {
        void invoke('set_pit_warning_laps', {
          laps: settings.fuel.pitWarningLaps,
        }).catch((e) => console.error('Failed to update pit warning laps:', e));
      }
    }
  }

  private handleWidgetSpecificResize(
    id: string,
    prevSettings: WidgetCustomSettings | undefined,
    newSettings: WidgetCustomSettings
  ) {
    const widget = this.getWidget(id);
    if (!widget) return;

    if (id === 'linear-map' && newSettings['linear-map']?.orientation) {
      const prevOrientation = prevSettings?.['linear-map']?.orientation;
      const nextOrientation = newSettings['linear-map'].orientation;
      if (prevOrientation !== nextOrientation) {
        const size = LINEAR_MAP_SIZES[nextOrientation];
        if (size) {
          widget.designWidth = size.designWidth;
          widget.designHeight = size.designHeight;
        }
        const prevW = widget.width;
        widget.width = widget.height;
        widget.height = prevW;
      }
    }

    if (id === 'input-trace' && newSettings['input-trace']?.barMode) {
      const prevBarMode =
        prevSettings?.['input-trace']?.barMode ?? 'horizontal';
      const nextBarMode = newSettings['input-trace'].barMode;
      if (prevBarMode !== nextBarMode && nextBarMode !== 'hidden') {
        const size = INPUT_TRACE_SIZES[nextBarMode];
        if (size) {
          widget.width = size.designWidth;
          widget.height = size.designHeight;
          widget.designWidth = size.designWidth;
          widget.designHeight = size.designHeight;
        }
      }
    }
  }

  private getSettings<T>(id: string, key: keyof WidgetCustomSettings): T {
    const widget = this.getWidget(id);
    const def = DEFAULT_WIDGETS.find((w) => w.id === id);
    const defaultSettings = def?.customSettings?.[key] as T;
    return (widget?.customSettings?.[key] as T) ?? defaultSettings;
  }

  getSpeedSettings(): SpeedWidgetSettings {
    return this.getSettings('speed', 'speed');
  }

  getInputTraceSettings(): InputTraceSettings {
    return this.getSettings('input-trace', 'input-trace');
  }

  getRadarSettings(id: 'proximity-radar' | 'radar-bar'): RadarSettings {
    return this.getSettings(id, id);
  }

  getStandingsSettings(): StandingsWidgetSettings {
    return this.getSettings('standings', 'standings');
  }

  getRelativeSettings(): RelativeWidgetSettings {
    return this.getSettings('relative', 'relative');
  }

  getTrackMapSettings(): TrackMapWidgetSettings {
    const settings = this.getSettings<TrackMapWidgetSettings>(
      'track-map',
      'track-map'
    );
    // Handle special default logic from original code
    const showSectors = settings.showSectors ?? true;
    return {
      ...settings,
      showSectors,
      showSectorTimes: settings.showSectorTimes ?? showSectors,
      showSectorsOnMap: settings.showSectorsOnMap ?? showSectors,
    };
  }

  getLinearMapSettings(): LinearMapWidgetSettings {
    return this.getSettings('linear-map', 'linear-map');
  }

  getWeatherSettings(): WeatherWidgetSettings {
    return this.getSettings('weather', 'weather');
  }

  getFuelSettings(): FuelWidgetSettings {
    return this.getSettings('fuel', 'fuel');
  }

  getLapTimesSettings(): LapTimesWidgetSettings {
    return this.getSettings('lap-times', 'lap-times');
  }

  getChassisSettings(): ChassisWidgetSettings {
    return this.getSettings('chassis', 'chassis');
  }

  getLapDeltaSettings(): LapDeltaWidgetSettings {
    return this.getSettings('lap-delta', 'lap-delta');
  }

  getTimerSettings(): TimerWidgetSettings {
    return this.getSettings('timer', 'timer');
  }

  getFlagDisplaySettings(id: 'flags' | 'flat-flags'): FlagDisplaySettings {
    return this.getSettings(id, id);
  }
}

export const widgetSettingsStore = new WidgetSettingsStore();

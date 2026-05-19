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
  BaseUserSettings,
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
  WidgetUserSettings,
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
    this.updateUserSettings('standings', {
      ...settings,
      enableClassCycling: !settings.enableClassCycling,
    });
  }

  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((defaultWidget) => {
        const savedWidget = widgets.find(
          (widget) => widget.id === defaultWidget.id
        );

        if (!savedWidget) {
          this.widgets.set(defaultWidget.id, { ...defaultWidget });
          return;
        }

        const mergedUserSettings = filterToDefaults(
          defaultWidget.userSettings,
          savedWidget.userSettings ?? {}
        );

        this.widgets.set(defaultWidget.id, {
          ...filterToDefaults(defaultWidget, savedWidget),
          userSettings: mergedUserSettings,
        });
      });
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

    widget.userSettings = {
      ...prevSettings,
      ...resolvedPartial,
    } as WidgetUserSettings;

    this.handleLayoutResize(id, prevSettings, widget.userSettings);

    if (id === 'fuel' && 'pitWarningLaps' in resolvedPartial) {
      void invoke('set_pit_warning_laps', {
        laps: (resolvedPartial as FuelWidgetSettings).pitWarningLaps,
      }).catch((error) =>
        console.error('Failed to update pit warning laps:', error)
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

    if (
      id === 'relative-map' &&
      'orientation' in newSettings &&
      newSettings.orientation
    ) {
      const prevOrientation =
        'orientation' in prevSettings ? prevSettings.orientation : undefined;
      const nextOrientation = newSettings.orientation;

      if (prevOrientation !== nextOrientation) {
        const size = LINEAR_MAP_SIZES[nextOrientation];

        if (size) {
          widget.designWidth = size.designWidth;
          widget.designHeight = size.designHeight;
        }

        const prevWidth = widget.userSettings.currentWidth;
        widget.userSettings.currentWidth = widget.userSettings.currentHeight;
        widget.userSettings.currentHeight = prevWidth;
      }
    }

    if (
      id === 'input-trace' &&
      'barMode' in newSettings &&
      newSettings.barMode
    ) {
      const prevBarMode =
        'barMode' in prevSettings ? prevSettings.barMode : 'vertical';
      const nextBarMode = newSettings.barMode;

      if (prevBarMode !== nextBarMode && nextBarMode !== 'hidden') {
        const size = INPUT_TRACE_SIZES[nextBarMode];

        if (size) {
          widget.userSettings.currentWidth = size.designWidth;
          widget.userSettings.currentHeight = size.designHeight;
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
        id === 'lap-times'
          ? LAP_TIMES_DEFAULT_WIDTHS
          : LAP_DELTA_DEFAULT_WIDTHS;

      const prevLayout =
        'layout' in prevSettings ? prevSettings.layout : 'vertical';
      const nextLayout = newSettings.layout;

      if (prevLayout !== nextLayout) {
        const prevLayoutWidths =
          'layoutWidths' in prevSettings
            ? (prevSettings.layoutWidths ?? {})
            : {};
        const savedWidths = {
          ...prevLayoutWidths,
          [prevLayout]: widget.userSettings.currentWidth,
        };
        const nextWidth = savedWidths[nextLayout] ?? defaultWidths[nextLayout];

        widget.userSettings = {
          ...widget.userSettings,
          ...newSettings,
          layoutWidths: savedWidths,
        } as WidgetUserSettings;

        widget.userSettings.currentWidth =
          nextWidth ?? widget.userSettings.currentWidth;
        widget.designWidth = widget.userSettings.currentWidth;
      }
    }

    if (id === 'chassis' && 'showSuspensionAndBrakes' in newSettings) {
      const prevShowSuspensionAndBrakes =
        'showSuspensionAndBrakes' in prevSettings
          ? prevSettings.showSuspensionAndBrakes
          : false;
      const nextShowSuspensionAndBrakes = newSettings.showSuspensionAndBrakes;

      if (prevShowSuspensionAndBrakes !== nextShowSuspensionAndBrakes) {
        const chassisDesignWidth = 300;
        const suspensionAndBrakesDesignWidth = 430;
        const chassisDefaultWidth = 280;
        const suspensionAndBrakesDefaultWidth = 400;

        const prevMode = prevShowSuspensionAndBrakes
          ? 'suspensionAndBrakes'
          : 'chassis';
        const nextMode = nextShowSuspensionAndBrakes
          ? 'suspensionAndBrakes'
          : 'chassis';

        const prevModeWidths =
          'modeWidths' in prevSettings ? (prevSettings.modeWidths ?? {}) : {};

        const savedModeWidths = {
          ...prevModeWidths,
          [prevMode]: widget.userSettings.currentWidth,
        };

        const defaultNextWidth = nextShowSuspensionAndBrakes
          ? suspensionAndBrakesDefaultWidth
          : chassisDefaultWidth;

        const nextWidth = savedModeWidths[nextMode] ?? defaultNextWidth;

        widget.userSettings = {
          ...widget.userSettings,
          ...newSettings,
          modeWidths: savedModeWidths,
        } as WidgetUserSettings;

        widget.designWidth = nextShowSuspensionAndBrakes
          ? suspensionAndBrakesDesignWidth
          : chassisDesignWidth;
        widget.userSettings.currentWidth = nextWidth;
      }
    }
  }

  private getSettings<SpecificSettings extends WidgetSpecificSettings>(
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

  getSpeedSettings(): BaseUserSettings & SpeedWidgetSettings {
    return this.getSettings<SpeedWidgetSettings>('speed');
  }

  getInputTraceSettings(): BaseUserSettings & InputTraceSettings {
    return this.getSettings<InputTraceSettings>('input-trace');
  }

  getRadarSettings(
    id: 'proximity-radar' | 'radar-bar'
  ): BaseUserSettings & RadarSettings {
    return this.getSettings<RadarSettings>(id);
  }

  getStandingsSettings(): BaseUserSettings & StandingsWidgetSettings {
    return this.getSettings<StandingsWidgetSettings>('standings');
  }

  getRelativeSettings(): BaseUserSettings & RelativeWidgetSettings {
    return this.getSettings<RelativeWidgetSettings>('relative');
  }

  getTrackMapSettings(): BaseUserSettings & TrackMapWidgetSettings {
    const settings = this.getSettings<TrackMapWidgetSettings>('track-map');
    const showSectors = settings.showSectors ?? true;

    return {
      ...settings,
      showSectors,
      showSectorsOnMap: settings.showSectorsOnMap ?? showSectors,
    };
  }

  getLinearMapSettings(): BaseUserSettings & LinearMapWidgetSettings {
    return this.getSettings<LinearMapWidgetSettings>('relative-map');
  }

  getWeatherSettings(): BaseUserSettings & WeatherWidgetSettings {
    return this.getSettings<WeatherWidgetSettings>('weather');
  }

  getFuelSettings(): BaseUserSettings & FuelWidgetSettings {
    return this.getSettings<FuelWidgetSettings>('fuel');
  }

  getLapTimesSettings(): BaseUserSettings & LapTimesWidgetSettings {
    const settings = this.getSettings<LapTimesWidgetSettings>('lap-times');

    return { ...settings, showPredicted: settings.showPredicted ?? true };
  }

  getChassisSettings(): BaseUserSettings & ChassisWidgetSettings {
    return this.getSettings<ChassisWidgetSettings>('chassis');
  }

  getLapDeltaSettings(): BaseUserSettings & LapDeltaWidgetSettings {
    return this.getSettings<LapDeltaWidgetSettings>('lap-delta');
  }

  getTimerSettings(): BaseUserSettings & TimerWidgetSettings {
    return this.getSettings<TimerWidgetSettings>('timer');
  }

  getFlagDisplaySettings(
    id: 'led-flags' | 'flat-flags'
  ): BaseUserSettings & FlagDisplaySettings {
    return this.getSettings<FlagDisplaySettings>(id);
  }

  getGMeterSettings(): BaseUserSettings & GMeterWidgetSettings {
    return this.getSettings<GMeterWidgetSettings>('g-meter');
  }
}

export const widgetSettingsStore = new WidgetSettingsStore();

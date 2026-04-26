import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { computedStore } from './iracing';

import type {
  FlagsWidgetSettings,
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
  WidgetConfig,
  WidgetCustomSettings,
} from '../types/widget-settings';

const LINEAR_MAP_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  horizontal: { designWidth: 400, designHeight: 40 },
  vertical: { designWidth: 40, designHeight: 400 },
};

const LAP_DELTA_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  vertical: { designWidth: 220, designHeight: 180 },
  horizontal: { designWidth: 480, designHeight: 140 },
};

const LAP_TIMES_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  vertical: { designWidth: 220, designHeight: 104 },
  horizontal: { designWidth: 790, designHeight: 35 },
};

const INPUT_TRACE_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  horizontal: { designWidth: 400, designHeight: 220 },
  vertical: { designWidth: 400, designHeight: 110 },
};

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'speed',
    label: 'Speed (Gear, Speed, RPM)',
    description: 'Speedometer with gear and RPM indicator.',
    enabled: true,
    x: 400,
    y: 100,
    width: 360,
    height: 110,
    designWidth: 360,
    designHeight: 110,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: 'F10',
    customSettings: {
      speed: {
        focusMode: 'speed',
        rpmColorTheme: 'custom',
        rpmColorLow: '#22c55e',
        rpmColorMid: '#eab308',
        rpmColorHigh: '#ef4444',
        rpmColorLimit: '#ff4d00',
      },
    },
  },
  {
    id: 'input-trace',
    label: 'Input Trace (Throttle, Brake, Clutch)',
    description: 'Live throttle, brake, and clutch inputs.',
    enabled: false,
    x: 400,
    y: 300,
    width: 400,
    height: 220,
    designWidth: 400,
    designHeight: 220,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: 'F11',
    customSettings: {
      'input-trace': {
        showThrottle: true,
        showBrake: true,
        showClutch: true,
        throttleColor: '#00ff00',
        brakeColor: '#ff3333',
        clutchColor: '#3399ff',
        barMode: 'horizontal',
      },
    },
  },
  {
    id: 'proximity-radar',
    label: 'Proximity Radar',
    description: 'Visual radar for nearby traffic.',
    enabled: false,
    x: 600,
    y: 300,
    width: 200,
    height: 300,
    designWidth: 200,
    designHeight: 300,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: 'F6',
    customSettings: {
      'proximity-radar': {
        visibilityMode: 'proximity',
        proximityThreshold: 5,
        hideDelay: 2,
      },
    },
  },
  {
    id: 'radar-bar',
    label: 'Radar Bar',
    description: 'Full-width side proximity indicators.',
    enabled: false,
    x: 200,
    y: 300,
    width: 800,
    height: 380,
    designWidth: 800,
    designHeight: 380,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: 'F7',
    customSettings: {
      'radar-bar': {
        visibilityMode: 'proximity',
        proximityThreshold: 3,
        hideDelay: 2,
        barDisplayMode: 'both',
      },
    },
  },
  {
    id: 'standings',
    label: 'Standings',
    description: 'Live session standings and intervals.',
    enabled: false,
    x: 50,
    y: 50,
    width: 640,
    height: 450,
    designWidth: 640,
    designHeight: 450,
    backgroundColor: '#0a0a0f',
    backgroundColorEdge: '#050508',
    hotkey: 'F3',
    customSettings: {
      standings: {
        enableClassCycling: false,
        classCyclingToggleHotkey: '',
        classPrevHotkey: '',
        classNextHotkey: '',
        showPosChange: true,
        showColumnHeaders: true,
        showSessionHeader: true,
        showWeather: true,
        showSOF: true,
        showTotalDrivers: true,
        showBrand: true,
        showTire: true,
        showIRatingBadge: true,
        showClassBadge: true,
        showIrChange: false,
        showPitStops: true,
        showLapsCompleted: false,
        abbreviateNames: false,
      },
    },
  },
  {
    id: 'relative',
    label: 'Relative',
    description: 'Gaps to cars ahead and behind you.',
    enabled: false,
    x: 50,
    y: 300,
    width: 420,
    height: 400,
    designWidth: 420,
    designHeight: 400,
    backgroundColor: '#0a0a0f',
    backgroundColorEdge: '#050508',
    hotkey: 'F4',
    customSettings: {
      relative: {
        showIRatingBadge: true,
        showClassBadge: true,
        showPitIndicator: true,
        abbreviateNames: true,
      },
    },
  },
  {
    id: 'track-map',
    label: 'Track Map',
    description: 'Dynamic 2D map of the current circuit.',
    enabled: false,
    x: 800,
    y: 50,
    width: 400,
    height: 400,
    designWidth: 400,
    designHeight: 400,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: 'F5',
    customSettings: {
      'track-map': {
        showLegend: true,
        legendPosition: 'right',
        showSectors: true,
        rotationMode: 'fixed',
      },
    },
  },
  {
    id: 'linear-map',
    label: 'Linear Map',
    description: 'Progress bar of car track positions.',
    enabled: false,
    x: 50,
    y: 820,
    width: 400,
    height: 40,
    designWidth: 400,
    designHeight: 40,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
    customSettings: {
      'linear-map': {
        orientation: 'horizontal',
      },
    },
  },
  {
    id: 'flags',
    label: 'LED Flags',
    description: 'Track flags and digital warning lights.',
    enabled: false,
    x: 760,
    y: 0,
    width: 630,
    height: 189,
    designWidth: 630,
    designHeight: 189,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: '',
    customSettings: {
      flags: {
        variant: 'overlay',
        cutoutWidth: 6,
        cutoutHeight: 1,
      },
    },
  },
  {
    id: 'chassis',
    label: 'Chassis (Tires & Suspension)',
    description: 'Tire pressures and brake temperatures.',
    enabled: false,
    x: 100,
    y: 100,
    width: 460,
    height: 320,
    designWidth: 460,
    designHeight: 320,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'example',
    label: 'Telemetry Debug',
    description: 'Raw telemetry data debugger.',
    enabled: false,
    x: 100,
    y: 100,
    width: 400,
    height: 700,
    designWidth: 400,
    designHeight: 700,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: 'F8',
  },
  {
    id: 'lap-delta',
    label: 'Lap Delta',
    description: 'Live delta against your best lap time.',
    enabled: false,
    x: 400,
    y: 200,
    width: 220,
    height: 180,
    designWidth: 220,
    designHeight: 180,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'lap-times',
    label: 'Lap Times',
    description: 'Detailed history of your lap times.',
    enabled: false,
    x: 400,
    y: 300,
    width: 220,
    height: 104,
    designWidth: 220,
    designHeight: 104,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
    customSettings: {
      'lap-times': {
        showLastLap: true,
        showBestLap: true,
        showP1: true,
        layout: 'vertical',
      },
    },
  },
  {
    id: 'session',
    label: 'Session Info',
    description: 'Session status and time remaining.',
    enabled: false,
    x: 50,
    y: 200,
    width: 300,
    height: 100,
    designWidth: 300,
    designHeight: 100,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'timer',
    label: 'Session Timer',
    description: 'Stint and total session timers.',
    enabled: false,
    x: 50,
    y: 310,
    width: 240,
    height: 120,
    designWidth: 240,
    designHeight: 120,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Track conditions and wind information.',
    enabled: false,
    x: 760,
    y: 200,
    width: 240,
    height: 280,
    designWidth: 240,
    designHeight: 280,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
    customSettings: {
      weather: {
        showCompass: true,
        showAirTemp: true,
        showTrackTemp: true,
        showWind: true,
        showHumidity: true,
      },
    },
  },
  {
    id: 'fuel',
    label: 'Fuel Strategy',
    description: 'Fuel level and consumption calculator.',
    enabled: false,
    x: 760,
    y: 500,
    width: 240,
    height: 360,
    designWidth: 240,
    designHeight: 360,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
    customSettings: {
      fuel: {
        showChart: false,
        pitWarningLaps: 3,
        chartType: 'bar',
      },
    },
  },
];

class WidgetSettingsStore {
  widgets: WidgetConfig[] = DEFAULT_WIDGETS;

  standingsActiveClassIndex = 0;

  isTrackMapForceStartPending = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setTrackMapForceStartPending(pending: boolean) {
    this.isTrackMapForceStartPending = pending;
  }

  private getStandingsClassCount(): number {
    const entries = computedStore.standings?.entries ?? [];
    return new Set(entries.map((e) => e.carClassId)).size;
  }

  cycleStandingsPrev() {
    const total = this.getStandingsClassCount();
    if (total <= 1) return;
    this.standingsActiveClassIndex =
      this.standingsActiveClassIndex === 0
        ? total - 1
        : this.standingsActiveClassIndex - 1;
  }

  cycleStandingsNext() {
    const total = this.getStandingsClassCount();
    if (total <= 1) return;
    this.standingsActiveClassIndex =
      this.standingsActiveClassIndex === total - 1
        ? 0
        : this.standingsActiveClassIndex + 1;
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
    // Merge incoming widgets with defaults to ensure new fields/widgets are present
    this.widgets = DEFAULT_WIDGETS.map((def) => {
      const s = widgets.find((w) => w.id === def.id);
      if (!s) return def;

      const defCS = def.customSettings ?? {};
      const sCS = s.customSettings ?? {};

      const mergedCustomSettings: WidgetCustomSettings = { ...defCS };
      for (const key of Object.keys(sCS) as Array<keyof WidgetCustomSettings>) {
        mergedCustomSettings[key] = {
          ...defCS[key],
          ...sCS[key],
        } as never;
      }

      return {
        ...def,
        ...s,
        customSettings: mergedCustomSettings,
      };
    });
  }

  getWidget(id: string): WidgetConfig | undefined {
    return this.widgets.find((w) => w.id === id);
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.updateField(id, 'enabled', enabled);
  }

  updatePosition(id: string, x: number, y: number) {
    const widget = this.widgets.find((w) => w.id === id);
    if (widget && (widget.x !== x || widget.y !== y)) {
      widget.x = x;
      widget.y = y;
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.widgets.find((w) => w.id === id);
    if (widget && (widget.width !== width || widget.height !== height)) {
      widget.width = width;
      widget.height = height;
    }
  }

  updateField<K extends keyof WidgetConfig>(
    id: string,
    field: K,
    value: WidgetConfig[K]
  ) {
    const widget = this.widgets.find((w) => w.id === id);
    if (widget) {
      widget[field] = value;
    }
  }

  updateCustomSettings(id: string, settings: WidgetCustomSettings) {
    const widget = this.widgets.find((w) => w.id === id);
    if (widget) {
      const prevSettings = widget.customSettings;

      widget.customSettings = {
        ...prevSettings,
        ...settings,
      };

      if (
        id === 'linear-map' &&
        settings['linear-map'] &&
        'orientation' in settings['linear-map']
      ) {
        const prevOrientation = prevSettings?.['linear-map']?.orientation;
        const nextOrientation = settings['linear-map'].orientation;
        if (prevOrientation !== nextOrientation) {
          const size = LINEAR_MAP_SIZES[nextOrientation];
          if (size) {
            widget.width = size.designWidth;
            widget.height = size.designHeight;
            widget.designWidth = size.designWidth;
            widget.designHeight = size.designHeight;
          }
        }
      }

      if (
        id === 'lap-delta' &&
        settings['lap-delta'] &&
        'layout' in settings['lap-delta']
      ) {
        const prevLayout = prevSettings?.['lap-delta']?.layout ?? 'vertical';
        const nextLayout = settings['lap-delta'].layout;
        if (prevLayout !== nextLayout) {
          const size = LAP_DELTA_SIZES[nextLayout];
          if (size) {
            widget.width = size.designWidth;
            widget.height = size.designHeight;
            widget.designWidth = size.designWidth;
            widget.designHeight = size.designHeight;
          }
        }
      }

      if (
        id === 'lap-times' &&
        settings['lap-times'] &&
        'layout' in settings['lap-times']
      ) {
        const prevLayout = prevSettings?.['lap-times']?.layout ?? 'vertical';
        const nextLayout = settings['lap-times'].layout;
        if (prevLayout !== nextLayout) {
          const size = LAP_TIMES_SIZES[nextLayout];
          if (size) {
            widget.width = size.designWidth;
            widget.height = size.designHeight;
            widget.designWidth = size.designWidth;
            widget.designHeight = size.designHeight;
          }
        }
      }

      if (
        id === 'input-trace' &&
        settings['input-trace'] &&
        'barMode' in settings['input-trace']
      ) {
        const prevBarMode =
          prevSettings?.['input-trace']?.barMode ?? 'horizontal';
        const nextBarMode = settings['input-trace'].barMode;
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

      if (id === 'fuel' && settings.fuel && 'pitWarningLaps' in settings.fuel) {
        void invoke('set_pit_warning_laps', {
          laps: settings.fuel.pitWarningLaps,
        }).catch((e) => console.error('Failed to update pit warning laps:', e));
      }
    }
  }

  getSpeedSettings(): SpeedWidgetSettings {
    const widget = this.getWidget('speed');
    return (
      widget?.customSettings?.speed ?? {
        focusMode: 'speed',
        rpmColorTheme: 'custom',
        rpmColorLow: '#22c55e',
        rpmColorMid: '#eab308',
        rpmColorHigh: '#ef4444',
        rpmColorLimit: '#ff4d00',
      }
    );
  }

  getInputTraceSettings(): InputTraceSettings {
    const widget = this.getWidget('input-trace');
    return (
      widget?.customSettings?.['input-trace'] ?? {
        showThrottle: true,
        showBrake: true,
        showClutch: true,
        throttleColor: '#00ff00',
        brakeColor: '#ff3333',
        clutchColor: '#3399ff',
        barMode: 'horizontal',
      }
    );
  }

  getRadarSettings(id: 'proximity-radar' | 'radar-bar'): RadarSettings {
    const widget = this.getWidget(id);
    return (
      widget?.customSettings?.[id] ?? {
        visibilityMode: 'proximity',
        proximityThreshold: id === 'proximity-radar' ? 5 : 3,
        hideDelay: 2,
      }
    );
  }

  getStandingsSettings(): StandingsWidgetSettings {
    const widget = this.getWidget('standings');
    return (
      widget?.customSettings?.standings ?? {
        enableClassCycling: false,
        classCyclingToggleHotkey: '',
        classPrevHotkey: '',
        classNextHotkey: '',
        showPosChange: true,
        showColumnHeaders: true,
        showSessionHeader: true,
        showWeather: true,
        showSOF: true,
        showTotalDrivers: true,
        showBrand: true,
        showTire: true,
        showIRatingBadge: true,
        showClassBadge: true,
        showIrChange: false,
        showPitStops: true,
        showLapsCompleted: false,
        abbreviateNames: false,
      }
    );
  }

  getRelativeSettings(): RelativeWidgetSettings {
    const widget = this.getWidget('relative');
    return (
      widget?.customSettings?.relative ?? {
        showIRatingBadge: true,
        showClassBadge: true,
        showPitIndicator: true,
        abbreviateNames: true,
      }
    );
  }

  getTrackMapSettings(): TrackMapWidgetSettings {
    const widget = this.getWidget('track-map');
    return (
      widget?.customSettings?.['track-map'] ?? {
        showLegend: true,
        legendPosition: 'right',
        showSectors: true,
        rotationMode: 'fixed',
      }
    );
  }

  getLinearMapSettings(): LinearMapWidgetSettings {
    const widget = this.getWidget('linear-map');
    return (
      widget?.customSettings?.['linear-map'] ?? {
        orientation: 'horizontal',
      }
    );
  }

  getWeatherSettings(): WeatherWidgetSettings {
    const widget = this.getWidget('weather');
    return (
      widget?.customSettings?.weather ?? {
        showCompass: true,
        showAirTemp: true,
        showTrackTemp: true,
        showWind: true,
        showHumidity: true,
      }
    );
  }

  getFuelSettings(): FuelWidgetSettings {
    const widget = this.getWidget('fuel');
    return (
      widget?.customSettings?.fuel ?? {
        showChart: false,
        pitWarningLaps: 3,
        chartType: 'bar',
      }
    );
  }

  getFlagsSettings(): FlagsWidgetSettings {
    const widget = this.getWidget('flags');
    return (
      widget?.customSettings?.flags ?? {
        variant: 'overlay',
        cutoutWidth: 6,
        cutoutHeight: 1,
      }
    );
  }

  getLapTimesSettings(): LapTimesWidgetSettings {
    const widget = this.getWidget('lap-times');
    return (
      widget?.customSettings?.['lap-times'] ?? {
        showLastLap: true,
        showBestLap: true,
        showP1: true,
        layout: 'vertical',
      }
    );
  }

  getLapDeltaSettings(): LapDeltaWidgetSettings {
    const widget = this.getWidget('lap-delta');
    return (
      widget?.customSettings?.['lap-delta'] ?? {
        layout: 'vertical',
      }
    );
  }
}

export const widgetSettingsStore = new WidgetSettingsStore();

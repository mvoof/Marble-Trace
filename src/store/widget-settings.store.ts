import { makeAutoObservable } from 'mobx';

export type SpeedWidgetFocusMode = 'speed' | 'gear';
export type RpmColorTheme = 'custom' | 'gradient' | 'classic';

export interface SpeedWidgetSettings {
  focusMode: SpeedWidgetFocusMode;
  rpmColorTheme: RpmColorTheme;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorLimit: string;
}

export type InputTraceBarMode = 'horizontal' | 'vertical' | 'hidden';

export interface InputTraceSettings {
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
  throttleColor: string;
  brakeColor: string;
  clutchColor: string;
  barMode: InputTraceBarMode;
}

export type RadarVisibilityMode = 'always' | 'proximity';
export type RadarBarDisplayMode = 'both' | 'active-only';

export interface RadarSettings {
  visibilityMode: RadarVisibilityMode;
  proximityThreshold: number;
  hideDelay: number;
  barSpacing?: number;
  /** radar-bar: show both bars or only the side with a detected car */
  barDisplayMode?: RadarBarDisplayMode;
}

export type StandingsFilterMode = 'all';

export interface StandingsWidgetSettings {
  groupByClass: boolean;
  filterMode: StandingsFilterMode;
  showPosChange: boolean;
  showColumnHeaders: boolean;
  showSessionHeader: boolean;
  showWeather: boolean;
  showSOF: boolean;
  showTotalDrivers: boolean;
  showBrand: boolean;
  showTire: boolean;
  /** Projected iR change column (Elo-based estimate, not real SDK data) */
  showIrChange: boolean;
  /** Player-only pit stop counter (counted on the frontend) */
  showPitStops: boolean;
}

export interface RelativeWidgetSettings {
  showIRatingBadge: boolean;
  showClassBadge: boolean;
  showPitIndicator: boolean;
  abbreviateNames: boolean;
}

export type TrackMapLegendPosition = 'left' | 'right' | 'hidden';
export type TrackMapRotationMode = 'fixed' | 'heading-up';

export interface TrackMapWidgetSettings {
  showLegend: boolean;
  legendPosition: TrackMapLegendPosition;
  showSectors: boolean;
  showCornerNumbers: boolean;
  rotationMode: TrackMapRotationMode;
}

export type LinearMapOrientation = 'horizontal' | 'vertical';

export interface LinearMapWidgetSettings {
  orientation: LinearMapOrientation;
}

export type FlagsVariant = 'overlay' | 'under-mirror' | 'standalone';

export interface FlagsWidgetSettings {
  variant: FlagsVariant;
  cutoutWidth: number;
  cutoutHeight: number;
}

export interface WeatherWidgetSettings {
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
}

export interface FuelWidgetSettings {
  showChart: boolean;
  pitWarningLaps: number;
  chartType: 'line' | 'bar';
}

export interface WidgetCustomSettings {
  speed?: SpeedWidgetSettings;
  'input-trace'?: InputTraceSettings;
  'proximity-radar'?: RadarSettings;
  'radar-bar'?: RadarSettings;
  standings?: StandingsWidgetSettings;
  relative?: RelativeWidgetSettings;
  'track-map'?: TrackMapWidgetSettings;
  'linear-map'?: LinearMapWidgetSettings;
  flags?: FlagsWidgetSettings;
  weather?: WeatherWidgetSettings;
  fuel?: FuelWidgetSettings;
}

export interface WidgetConfig {
  id: string;
  label: string;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor: string;
  backgroundColorEdge: string;
  hotkey: string;
  customSettings?: WidgetCustomSettings;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'speed',
    label: 'Speed (Gear, Speed, RPM)',
    enabled: true,
    x: 400,
    y: 100,
    width: 290,
    height: 80,
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
    enabled: false,
    x: 400,
    y: 300,
    width: 400,
    height: 220,
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
    enabled: false,
    x: 600,
    y: 300,
    width: 300,
    height: 300,
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
    enabled: false,
    x: 200,
    y: 300,
    width: 800,
    height: 380,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: 'F7',
    customSettings: {
      'radar-bar': {
        visibilityMode: 'proximity',
        proximityThreshold: 3,
        hideDelay: 2,
        barSpacing: 0,
        barDisplayMode: 'both',
      },
    },
  },
  {
    id: 'standings',
    label: 'Standings',
    enabled: false,
    x: 50,
    y: 50,
    width: 700,
    height: 500,
    backgroundColor: '#0a0a0f',
    backgroundColorEdge: '#050508',
    hotkey: 'F3',
    customSettings: {
      standings: {
        groupByClass: true,
        filterMode: 'all',
        showPosChange: true,
        showColumnHeaders: true,
        showSessionHeader: true,
        showWeather: true,
        showSOF: true,
        showTotalDrivers: true,
        showBrand: true,
        showTire: true,
        showIrChange: false,
        showPitStops: true,
      },
    },
  },
  {
    id: 'relative',
    label: 'Relative',
    enabled: false,
    x: 50,
    y: 300,
    width: 420,
    height: 500,
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
    enabled: false,
    x: 800,
    y: 50,
    width: 400,
    height: 400,
    backgroundColor: 'transparent',
    backgroundColorEdge: 'transparent',
    hotkey: 'F5',
    customSettings: {
      'track-map': {
        showLegend: true,
        legendPosition: 'right',
        showSectors: true,
        showCornerNumbers: true,
        rotationMode: 'fixed',
      },
    },
  },
  {
    id: 'linear-map',
    label: 'Linear Map',
    enabled: false,
    x: 50,
    y: 820,
    width: 400,
    height: 40,
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
    enabled: false,
    x: 760,
    y: 0,
    width: 630,
    height: 189,
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
    enabled: false,
    x: 100,
    y: 100,
    width: 460,
    height: 320,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'example',
    label: 'Telemetry Debug',
    enabled: false,
    x: 100,
    y: 100,
    width: 400,
    height: 700,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: 'F8',
  },
  {
    id: 'lap-delta',
    label: 'Lap Delta',
    enabled: false,
    x: 400,
    y: 200,
    width: 240,
    height: 140,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'lap-times',
    label: 'Lap Times',
    enabled: false,
    x: 400,
    y: 300,
    width: 260,
    height: 160,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'session',
    label: 'Session Info',
    enabled: false,
    x: 50,
    y: 200,
    width: 300,
    height: 100,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'timer',
    label: 'Session Timer',
    enabled: false,
    x: 50,
    y: 310,
    width: 240,
    height: 120,
    backgroundColor: '#1a1a1a',
    backgroundColorEdge: '#0a0a0a',
    hotkey: '',
  },
  {
    id: 'weather',
    label: 'Weather',
    enabled: false,
    x: 760,
    y: 200,
    width: 240,
    height: 280,
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
    enabled: false,
    x: 760,
    y: 500,
    width: 240,
    height: 220,
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

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setWidgets(widgets: WidgetConfig[]) {
    // Merge incoming widgets with defaults to ensure new fields/widgets are present
    this.widgets = DEFAULT_WIDGETS.map((def) => {
      const s = widgets.find((w) => w.id === def.id);
      if (!s) return def;

      return {
        ...def,
        ...s,
        customSettings: {
          ...def.customSettings,
          ...s.customSettings,
        },
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
      widget.customSettings = {
        ...widget.customSettings,
        ...settings,
      };
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
        groupByClass: true,
        filterMode: 'all',
        showPosChange: true,
        showColumnHeaders: true,
        showSessionHeader: true,
        showWeather: true,
        showSOF: true,
        showTotalDrivers: true,
        showBrand: true,
        showTire: true,
        showIrChange: false,
        showPitStops: true,
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
        showCornerNumbers: true,
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
}

export const widgetSettingsStore = new WidgetSettingsStore();

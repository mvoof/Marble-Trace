import { makeAutoObservable, runInAction } from 'mobx';
import { load, Store } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';

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

export interface WidgetCustomSettings {
  speed?: SpeedWidgetSettings;
  'input-trace'?: InputTraceSettings;
  'proximity-radar'?: RadarSettings;
  'radar-bar'?: RadarSettings;
  standings?: StandingsWidgetSettings;
  relative?: RelativeWidgetSettings;
  'track-map'?: TrackMapWidgetSettings;
  'linear-map'?: LinearMapWidgetSettings;
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
    width: 350,
    height: 500,
    backgroundColor: '#0a0a0f',
    backgroundColorEdge: '#050508',
    hotkey: 'F4',
    customSettings: {
      relative: {
        showIRatingBadge: true,
        showClassBadge: true,
        showPitIndicator: true,
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
];

interface WidgetFieldUpdate {
  id: string;
  field: keyof WidgetConfig;
  value: number | string | boolean | WidgetCustomSettings;
}

class WidgetSettingsStore {
  widgets: WidgetConfig[] = [];
  private store: Store | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private overlayUnlisten: UnlistenFn | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async loadSettings() {
    this.store = await load('widget-settings.json');
    const saved = await this.store.get<WidgetConfig[]>('widgets');

    runInAction(() => {
      if (!saved) {
        this.widgets = [...DEFAULT_WIDGETS];
      } else {
        // Migrate renamed widget IDs
        const merged = saved.map((w) => {
          if (w.id === 'dash') {
            return { ...w, id: 'speed', label: 'Speed (Gear, Speed, RPM)' };
          }

          return w;
        });

        for (const defaultWidget of DEFAULT_WIDGETS) {
          if (!merged.find((w) => w.id === defaultWidget.id)) {
            merged.push(defaultWidget);
          }
        }

        // Migrate: add backgroundColorEdge if missing
        for (const w of merged) {
          if (!w.backgroundColorEdge) {
            const def = DEFAULT_WIDGETS.find((d) => d.id === w.id);
            w.backgroundColorEdge = def?.backgroundColorEdge ?? '#0a0a0a';
          }
        }

        this.widgets = merged;
      }
    });
  }

  private debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);

    this.saveTimeout = setTimeout(() => this.saveSettings(), 500);
  }

  private async saveSettings() {
    if (!this.store) return;

    await this.store.set('widgets', this.widgets);
    await this.store.save();
  }

  getWidget(id: string): WidgetConfig | undefined {
    return this.widgets.find((w) => w.id === id);
  }

  /** Called by the overlay window to sync settings changes from the main window. */
  async initOverlayListener() {
    this.overlayUnlisten = await listen<WidgetFieldUpdate>(
      'widget-settings-changed',
      (event) => {
        const { id, field, value } = event.payload;
        const widget = this.widgets.find((w) => w.id === id);

        if (widget) {
          runInAction(() => {
            if (field === 'customSettings') {
              widget.customSettings = value as WidgetCustomSettings;
            } else {
              (widget[field] as number | string | boolean) = value as
                | number
                | string
                | boolean;
            }
          });
        }
      }
    );
  }

  disposeOverlayListener() {
    this.overlayUnlisten?.();
    this.overlayUnlisten = null;
  }

  setWidgetEnabled(id: string, enabled: boolean) {
    this.updateField(id, 'enabled', enabled);
  }

  updatePosition(id: string, x: number, y: number) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget && (widget.x !== x || widget.y !== y)) {
      widget.x = x;
      widget.y = y;

      this.debouncedSave();

      emit('widget-settings-changed', { id, field: 'x', value: x });
      emit('widget-settings-changed', { id, field: 'y', value: y });
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget && (widget.width !== width || widget.height !== height)) {
      widget.width = width;
      widget.height = height;

      this.debouncedSave();

      emit('widget-settings-changed', { id, field: 'width', value: width });
      emit('widget-settings-changed', { id, field: 'height', value: height });
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

  getStandingsSettings(): StandingsWidgetSettings {
    const widget = this.getWidget('standings');
    // Tolerate the legacy shape (`groupMode` / `viewMode` / `maxRowsPerClass`)
    // so users that already persisted older settings get migrated transparently.
    const saved = (widget?.customSettings?.standings ?? {}) as Partial<
      StandingsWidgetSettings & {
        groupMode?: 'overall' | 'class';
        viewMode?: string;
        maxRowsPerClass?: number;
        filterMode?: string;
      }
    >;

    const migratedGroupByClass =
      saved.groupByClass ??
      (saved.groupMode ? saved.groupMode === 'class' : true);

    const migratedFilterMode: StandingsFilterMode = 'all';

    return {
      groupByClass: migratedGroupByClass,
      filterMode: migratedFilterMode,
      showPosChange: saved.showPosChange ?? true,
      showColumnHeaders: saved.showColumnHeaders ?? true,
      showSessionHeader: saved.showSessionHeader ?? true,
      showWeather: saved.showWeather ?? true,
      showSOF: saved.showSOF ?? true,
      showTotalDrivers: saved.showTotalDrivers ?? true,
      showBrand: saved.showBrand ?? true,
      showTire: saved.showTire ?? true,
      showIrChange: saved.showIrChange ?? false,
      showPitStops: saved.showPitStops ?? true,
    };
  }

  getRelativeSettings(): RelativeWidgetSettings {
    const widget = this.getWidget('relative');
    const saved: Partial<RelativeWidgetSettings> =
      widget?.customSettings?.relative ?? {};
    return {
      showIRatingBadge: saved.showIRatingBadge ?? true,
      showClassBadge: saved.showClassBadge ?? true,
      showPitIndicator: saved.showPitIndicator ?? true,
    };
  }

  getTrackMapSettings(): TrackMapWidgetSettings {
    const widget = this.getWidget('track-map');
    const saved: Partial<TrackMapWidgetSettings> =
      widget?.customSettings?.['track-map'] ?? {};
    return {
      showLegend: saved.showLegend ?? true,
      legendPosition: saved.legendPosition ?? 'right',
      showSectors: saved.showSectors ?? true,
      showCornerNumbers: saved.showCornerNumbers ?? true,
      rotationMode: saved.rotationMode ?? 'fixed',
    };
  }

  getLinearMapSettings(): LinearMapWidgetSettings {
    const widget = this.getWidget('linear-map');
    return (
      widget?.customSettings?.['linear-map'] ?? {
        orientation: 'horizontal',
      }
    );
  }

  getRadarSettings(id: 'proximity-radar' | 'radar-bar'): RadarSettings {
    const widget = this.getWidget(id);
    const defaults: RadarSettings =
      id === 'proximity-radar'
        ? {
            visibilityMode: 'proximity',
            proximityThreshold: 5,
            hideDelay: 2,
          }
        : {
            visibilityMode: 'proximity',
            proximityThreshold: 3,
            hideDelay: 2,
            barSpacing: 0,
            barDisplayMode: 'both',
          };
    return widget?.customSettings?.[id] ?? defaults;
  }

  updateCustomSettings(id: string, settings: WidgetCustomSettings) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget) {
      const oldBarMode = widget.customSettings?.['input-trace']?.barMode;
      widget.customSettings = { ...widget.customSettings, ...settings };

      // Handle Input Trace dimension changes based on bar mode
      const newBarMode = settings['input-trace']?.barMode;
      if (id === 'input-trace' && newBarMode && newBarMode !== oldBarMode) {
        if (newBarMode === 'vertical') {
          widget.width = 400;
          widget.height = 110;
        } else {
          widget.width = 400;
          widget.height = 220;
        }
      }

      this.debouncedSave();

      emit('widget-settings-changed', {
        id,
        field: 'customSettings',
        value: widget.customSettings,
      });
    }
  }

  updateField<T extends keyof WidgetConfig>(
    id: string,
    field: T,
    value: WidgetConfig[T]
  ) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget && widget[field] !== value) {
      widget[field] = value;

      this.debouncedSave();

      emit('widget-settings-changed', { id, field, value });
    }
  }
}

export const widgetSettingsStore = new WidgetSettingsStore();

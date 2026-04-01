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

export interface WidgetCustomSettings {
  speed?: SpeedWidgetSettings;
  'input-trace'?: InputTraceSettings;
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
  hotkey: string;
  customSettings?: WidgetCustomSettings;
}

interface WidgetFieldUpdate {
  id: string;
  field: keyof WidgetConfig;
  value: number | string | boolean | WidgetCustomSettings;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'speed',
    label: 'Speed (Gear, Speed, RPM)',
    enabled: true,
    x: 400,
    y: 100,
    width: 290,
    height: 80,
    backgroundColor: '#1a1a1a',
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
];

class WidgetSettingsStore {
  widgets: WidgetConfig[] = [];
  private store: Store | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private unlisten: UnlistenFn | null = null;

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

        this.widgets = merged;
      }
    });
  }

  /** Listen for widget setting changes from other windows (used by widget windows). */
  async initWidgetListener() {
    this.unlisten = await listen<WidgetFieldUpdate>(
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

  dispose() {
    this.unlisten?.();
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

  setWidgetEnabled(id: string, enabled: boolean) {
    this.updateField(id, 'enabled', enabled);
  }

  updatePosition(id: string, x: number, y: number) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget && (widget.x !== x || widget.y !== y)) {
      widget.x = x;
      widget.y = y;

      this.debouncedSave();
    }
  }

  updateSize(id: string, width: number, height: number) {
    const widget = this.widgets.find((w) => w.id === id);

    if (widget && (widget.width !== width || widget.height !== height)) {
      widget.width = width;
      widget.height = height;

      this.debouncedSave();
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

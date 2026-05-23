import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  SessionInfo,
  WeatherForecastEntry,
  TelemetryBundle,
} from '@/types/bindings';
import { debug } from '@utils/debug';
import type { TelemetryStatus } from '@/types';
import type { RootStore } from '../root-store';

const EVENT_CAR_DYNAMICS = 1 << 0;
const EVENT_CAR_INPUTS = 1 << 1;
const EVENT_LAP_DELTA = 1 << 2;
const EVENT_CAR_POSITIONS = 1 << 3;

export class TelemetryConnectionStore {
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  error: string | null = null;
  frameCount = 0;

  private initId = 0;
  private unlistens: UnlistenFn[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  init() {
    if (
      typeof window !== 'undefined' &&
      !window.location.hash.includes('overlay')
    ) {
      reaction(
        () => ({
          widgets: this.root.widgetSettings.allWidgets.map((w) => ({
            id: w.id,
            enabled: w.userSettings.enabled,
          })),
          hideAll: this.root.appSettings.appSettings.hideAllWidgets,
        }),
        () => this.updateActiveEvents(),
        { fireImmediately: true }
      );
    }
  }

  private updateActiveEvents() {
    const widgets = this.root.widgetSettings.allWidgets;
    const hideAll = this.root.appSettings.appSettings.hideAllWidgets;

    let mask = 0;

    if (!hideAll) {
      const isEnabled = (id: string) =>
        widgets.find((w) => w.id === id)?.userSettings.enabled ?? false;

      if (
        isEnabled('speed') ||
        isEnabled('g-meter') ||
        isEnabled('weather') ||
        isEnabled('track-map')
      ) {
        mask |= EVENT_CAR_DYNAMICS;
      }

      if (isEnabled('input-trace')) {
        mask |= EVENT_CAR_INPUTS;
      }

      if (isEnabled('lap-delta')) {
        mask |= EVENT_LAP_DELTA;
      }

      if (
        isEnabled('track-map') ||
        isEnabled('relative-map') ||
        isEnabled('relative')
      ) {
        mask |= EVENT_CAR_POSITIONS;
      }
    }

    void invoke('set_active_events', { mask });
  }

  async startStream() {
    const currentId = ++this.initId;

    this.disposeListeners();

    try {
      await invoke('stop_telemetry_stream');
    } catch {
      // ignore
    }

    if (this.initId !== currentId) return;

    await this.subscribeAllEvents(currentId);

    if (this.initId !== currentId) {
      this.disposeListeners();
      return;
    }

    debug.telemetry('starting stream...');

    try {
      const initialInfo = await invoke<SessionInfo | null>(
        'get_last_session_info'
      );

      if (initialInfo && this.initId === currentId) {
        this.root.telemetry.updateSessionInfo(initialInfo);
      }

      await invoke('start_telemetry_stream');

      if (this.initId === currentId) {
        debug.telemetry('stream started');
      }
    } catch (err) {
      if (this.initId === currentId) {
        console.error('[Telemetry] Stream error:', err);
        this.setError(String(err));
      }
    }
  }

  async stopStream() {
    this.initId++;
    this.disposeListeners();

    try {
      await invoke('stop_telemetry_stream');
    } catch {
      // ignore
    }

    this.setDisconnected();
  }

  async startWidgetListener() {
    this.disposeListeners();

    await this.subscribeAllEvents(this.initId);

    try {
      const initialInfo = await invoke<SessionInfo | null>(
        'get_last_session_info'
      );

      if (initialInfo) {
        this.root.telemetry.updateSessionInfo(initialInfo);
      }
    } catch (err) {
      debug.telemetry('Failed to fetch initial session info: %o', err);
    }
  }

  stopWidgetListener() {
    this.disposeListeners();
  }

  private setStatus(status: TelemetryStatus) {
    this.status = status;

    if (status === 'connected') {
      this.isConnected = true;
      this.error = null;
    } else if (status === 'waiting') {
      this.isConnected = false;

      this.root.telemetry.reset();
      this.root.backendComputed.reset();
    } else if (status === 'disconnected') {
      this.isConnected = false;

      this.root.telemetry.reset();
      this.root.backendComputed.reset();
    }
  }

  private setError(error: string) {
    this.error = error;
    this.isConnected = false;
    this.status = 'error';
  }

  private setDisconnected() {
    this.isConnected = false;
    this.status = 'disconnected';
    this.root.telemetry.reset();
    this.root.backendComputed.reset();
  }

  private onFrameReceived() {
    this.frameCount++;
    this.isConnected = true;
    this.status = 'connected';
    this.error = null;
  }

  private async subscribeAllEvents(guardId: number) {
    this.unlistens.push(
      await listen<TelemetryBundle>('iracing://telemetry/bundle', (event) => {
        if (this.initId !== guardId) return;

        const b = event.payload;

        runInAction(() => {
          if (b.car_dynamics) {
            this.onFrameReceived();
            this.root.telemetry.updateCarDynamics(b.car_dynamics);
          }
          if (b.car_idx) this.root.telemetry.updateCarIdx(b.car_idx);
          if (b.car_inputs) this.root.telemetry.updateCarInputs(b.car_inputs);
          if (b.car_positions)
            this.root.telemetry.updateCarPositions(b.car_positions);
          if (b.car_status) this.root.telemetry.updateCarStatus(b.car_status);
          if (b.lap_timing) this.root.telemetry.updateLapTiming(b.lap_timing);
          if (b.session) this.root.telemetry.updateSession(b.session);
          if (b.environment)
            this.root.telemetry.updateEnvironment(b.environment);
          if (b.chassis) this.root.telemetry.updateChassis(b.chassis);

          if (b.proximity)
            this.root.backendComputed.updateProximity(b.proximity);
          if (b.fuel) this.root.backendComputed.updateFuel(b.fuel);
          if (b.standings)
            this.root.backendComputed.updateStandings(b.standings);
          if (b.pit_stops)
            this.root.backendComputed.updatePitStops(b.pit_stops);
          if (b.lap_delta)
            this.root.backendComputed.updateLapDelta(b.lap_delta);
        });
      })
    );

    this.unlistens.push(
      await listen<SessionInfo>('iracing://session-info', (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('session info received: %o', event.payload);
        this.root.telemetry.updateSessionInfo(event.payload);
      })
    );

    this.unlistens.push(
      await listen<string>('iracing://status', (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('status: %s', event.payload);
        this.setStatus(event.payload as TelemetryStatus);
      })
    );

    this.unlistens.push(
      await listen('iracing://disconnected', () => {
        if (this.initId !== guardId) return;

        debug.telemetry('stream disconnected');

        this.setDisconnected();
      })
    );

    this.unlistens.push(
      await listen<WeatherForecastEntry[]>(
        'iracing://weather-forecast',
        (event) => {
          if (this.initId !== guardId) return;

          this.root.telemetry.updateWeatherForecast(event.payload);
        }
      )
    );
  }

  private disposeListeners() {
    for (const unsub of this.unlistens) {
      unsub();
    }

    this.unlistens = [];
  }
}

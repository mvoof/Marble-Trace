import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  SessionInfo,
  WeatherForecastEntry,
  TelemetryBundle,
} from '../../types/bindings';
import { debug } from '../../utils/debug';

import { telemetryStore } from './telemetry.store';
import { computedStore } from './computed.store';
import { widgetSettingsStore } from '../widget-settings.store';
import { appSettingsStore } from '../app-settings.store';
import type { TelemetryStatus } from '../../types';

const EVENT_CAR_DYNAMICS = 1 << 0;
const EVENT_CAR_INPUTS = 1 << 1;
const EVENT_LAP_DELTA = 1 << 2;
const EVENT_CAR_POSITIONS = 1 << 3;

class TelemetryConnection {
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  error: string | null = null;
  frameCount = 0;

  private initId = 0;
  private unlistens: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });

    // Only master (main window) manages active events in Rust
    if (
      typeof window !== 'undefined' &&
      !window.location.hash.includes('overlay')
    ) {
      reaction(
        () => ({
          widgets: widgetSettingsStore.allWidgets.map((w) => ({
            id: w.id,
            enabled: w.userSettings.enabled,
          })),
          hideAll: appSettingsStore.settings.hideAllWidgets,
        }),
        () => this.updateActiveEvents(),
        { fireImmediately: true }
      );
    }
  }

  private updateActiveEvents() {
    const widgets = widgetSettingsStore.allWidgets;
    const hideAll = appSettingsStore.settings.hideAllWidgets;

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

  /** Main window: starts the telemetry stream + subscribes to all events */
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
        telemetryStore.updateSessionInfo(initialInfo);
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

  /** Main window: stops the telemetry stream */
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

  /** Widget windows: listen-only, no stream start/stop */
  async startWidgetListener() {
    this.disposeListeners();

    await this.subscribeAllEvents(this.initId);

    try {
      const initialInfo = await invoke<SessionInfo | null>(
        'get_last_session_info'
      );

      if (initialInfo) {
        telemetryStore.updateSessionInfo(initialInfo);
      }
    } catch (err) {
      debug.telemetry('Failed to fetch initial session info: %o', err);
    }
  }

  /** Widget windows: stop listening */
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

      telemetryStore.reset();
      computedStore.reset();
    } else if (status === 'disconnected') {
      this.isConnected = false;

      telemetryStore.reset();
      computedStore.reset();
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
    telemetryStore.reset();
    computedStore.reset();
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
            telemetryStore.updateCarDynamics(b.car_dynamics);
          }
          if (b.car_idx) telemetryStore.updateCarIdx(b.car_idx);
          if (b.car_inputs) telemetryStore.updateCarInputs(b.car_inputs);
          if (b.car_positions)
            telemetryStore.updateCarPositions(b.car_positions);
          if (b.car_status) telemetryStore.updateCarStatus(b.car_status);
          if (b.lap_timing) telemetryStore.updateLapTiming(b.lap_timing);
          if (b.session) telemetryStore.updateSession(b.session);
          if (b.environment) telemetryStore.updateEnvironment(b.environment);
          if (b.chassis) telemetryStore.updateChassis(b.chassis);

          if (b.proximity) computedStore.updateProximity(b.proximity);
          if (b.fuel) computedStore.updateFuel(b.fuel);
          if (b.standings) computedStore.updateStandings(b.standings);
          if (b.pit_stops) computedStore.updatePitStops(b.pit_stops);
          if (b.lap_delta) computedStore.updateLapDelta(b.lap_delta);
        });
      })
    );

    this.unlistens.push(
      await listen<SessionInfo>('iracing://session-info', (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('session info received: %o', event.payload);
        telemetryStore.updateSessionInfo(event.payload);
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

          telemetryStore.updateWeatherForecast(event.payload);
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

export const telemetryConnectionStore = new TelemetryConnection();

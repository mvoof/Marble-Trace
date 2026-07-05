import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  SessionSnapshot,
  TrackShapePayload,
  WeatherForecastEntry,
  TelemetryBundle,
  SimType,
  SimStatus,
  CapabilitiesPayload,
  ReferenceLapData,
} from '@/types/bindings';
import { debug } from '@utils/debug';
import type { TelemetryStatus } from '@/types';
import type { RootStore } from '@store/root-store';
import {
  SIM_TELEMETRY_BUNDLE,
  SIM_SESSION,
  SIM_WEATHER,
  SIM_STATUS,
  SIM_DISCONNECTED,
  SIM_TRACK_SHAPE,
  SIM_CAPABILITIES,
  SIM_REFERENCE_LAP_UPDATED,
  TRACK_MAP_CLEAR,
} from '@store/sync/sim-events';

const EVENT_CAR_DYNAMICS = 1 << 0;
const EVENT_CAR_INPUTS = 1 << 1;
const EVENT_LAP_DELTA = 1 << 2;
const EVENT_CAR_POSITIONS = 1 << 3;

export class SimStore {
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  currentSim: SimType | null = null;
  capabilities: CapabilitiesPayload | null = null;
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

    reaction(
      () => {
        const info = this.root.session.sessionInfo;
        const car = info?.cars.find(
          (entry) => entry.carIdx === info.playerCarIdx
        );

        return info && car
          ? { trackId: info.trackId, carScreenName: car.carScreenName }
          : null;
      },
      (identity, previousIdentity) => {
        if (!identity) return;

        if (
          previousIdentity &&
          previousIdentity.trackId === identity.trackId &&
          previousIdentity.carScreenName === identity.carScreenName
        ) {
          return;
        }

        void this.loadReferenceLap(identity.trackId, identity.carScreenName);
      },
      { fireImmediately: true }
    );
  }

  private async loadReferenceLap(trackId: number, carScreenName: string) {
    try {
      const data = await invoke<ReferenceLapData | null>('get_reference_lap', {
        trackId,
        carScreenName,
      });

      if (data) {
        runInAction(() => this.root.referenceLap.updateReferenceLap(data));
      }
    } catch (err) {
      debug.telemetry('Failed to load reference lap: %o', err);
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
        isEnabled('track-map') ||
        isEnabled('driving-coach')
      ) {
        mask |= EVENT_CAR_DYNAMICS;
      }

      if (isEnabled('input-trace') || isEnabled('driving-coach')) {
        mask |= EVENT_CAR_INPUTS;
      }

      if (isEnabled('delta')) {
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
      const initialInfo = await invoke<SessionSnapshot | null>(
        'get_last_session_info'
      );

      if (initialInfo && this.initId === currentId) {
        this.root.session.updateSessionInfo(initialInfo);
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
      const [isConnected, initialInfo] = await Promise.all([
        invoke<boolean>('get_connection_status'),
        invoke<SessionSnapshot | null>('get_last_session_info'),
      ]);

      runInAction(() => {
        if (isConnected) {
          this.status = 'connected';
          this.isConnected = true;
        }

        if (initialInfo) {
          this.root.session.updateSessionInfo(initialInfo);
        }
      });
    } catch (err) {
      debug.telemetry('Failed to fetch initial status: %o', err);
    }
  }

  stopWidgetListener() {
    this.disposeListeners();
  }

  private resetDataStores() {
    this.root.player.reset();
    this.root.cars.reset();
    this.root.session.reset();
    this.root.environment.reset();
    this.root.backendComputed.reset();
    this.root.drivingCoachWidget.reset();
  }

  private setStatus(status: TelemetryStatus) {
    this.status = status;

    if (status === 'connected') {
      this.isConnected = true;
      this.error = null;
    } else if (status === 'waiting') {
      this.isConnected = false;
      this.resetDataStores();
    } else if (status === 'disconnected') {
      this.isConnected = false;
      this.currentSim = null;
      this.capabilities = null;
      this.resetDataStores();
    }
  }

  private setError(error: string) {
    this.error = error;
    this.isConnected = false;
    this.status = 'error';
    this.currentSim = null;
    this.capabilities = null;
  }

  private setDisconnected() {
    this.isConnected = false;
    this.status = 'disconnected';
    this.currentSim = null;
    this.capabilities = null;
    this.resetDataStores();
  }

  private onFrameReceived() {
    this.frameCount++;
    this.isConnected = true;
    this.status = 'connected';
    this.error = null;
  }

  private async subscribeAllEvents(guardId: number) {
    this.unlistens.push(
      await listen<TelemetryBundle>(SIM_TELEMETRY_BUNDLE, (event) => {
        if (this.initId !== guardId) return;

        const b = event.payload;

        runInAction(() => {
          if (b.car_dynamics) {
            this.onFrameReceived();
            this.root.player.updateCarDynamics(b.car_dynamics);
          }
          if (b.car_idx) this.root.cars.updateCarIdx(b.car_idx);
          if (b.car_inputs) this.root.player.updateCarInputs(b.car_inputs);
          if (b.car_positions)
            this.root.cars.updateCarPositions(b.car_positions);
          if (b.car_status) this.root.player.updateCarStatus(b.car_status);
          if (b.lap_timing) this.root.player.updateLapTiming(b.lap_timing);
          this.root.player.updatePitTarget(
            b.pit_target_dist_m ?? null,
            b.pit_target_type ?? null,
            b.pit_lane_progress_pct ?? null
          );
          if (b.session) this.root.session.updateSession(b.session);
          if (b.environment)
            this.root.environment.updateEnvironment(b.environment);
          if (b.chassis) this.root.player.updateChassis(b.chassis);

          if (b.proximity)
            this.root.backendComputed.updateProximity(b.proximity);
          if (b.relative) this.root.backendComputed.updateRelative(b.relative);
          if (b.fuel) this.root.backendComputed.updateFuel(b.fuel);
          if (b.standings)
            this.root.backendComputed.updateStandings(b.standings);
          if (b.pit_stops)
            this.root.backendComputed.updatePitStops(b.pit_stops);
          if (b.lap_delta)
            this.root.backendComputed.updateLapDelta(b.lap_delta);
          if (b.lap_log) this.root.backendComputed.updateLapLog(b.lap_log);

          if (b.track_recording) {
            this.root.trackMapWidget.updateRecordingStatus(
              b.track_recording.isRecording,
              b.track_recording.isWaitingForSf,
              b.track_recording.progress,
              b.track_recording.pitLaneRecording
            );
          }
        });
      })
    );

    this.unlistens.push(
      await listen<SessionSnapshot>(SIM_SESSION, (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('session info received: %o', event.payload);
        this.root.session.updateSessionInfo(event.payload);
      })
    );

    this.unlistens.push(
      await listen<SimStatus>(SIM_STATUS, (event) => {
        if (this.initId !== guardId) return;

        const payload = event.payload;
        debug.telemetry('status: %o', payload);
        runInAction(() => {
          this.currentSim = payload.sim;
          this.setStatus(payload.status as TelemetryStatus);
        });
      })
    );

    this.unlistens.push(
      await listen(SIM_DISCONNECTED, () => {
        if (this.initId !== guardId) return;

        debug.telemetry('stream disconnected');

        this.setDisconnected();
      })
    );

    this.unlistens.push(
      await listen<WeatherForecastEntry[]>(SIM_WEATHER, (event) => {
        if (this.initId !== guardId) return;

        this.root.environment.updateWeatherForecast(event.payload);
      })
    );

    this.unlistens.push(
      await listen<TrackShapePayload>(SIM_TRACK_SHAPE, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.trackMapWidget.onTrackShapeReceived(event.payload);
        });
      })
    );

    this.unlistens.push(
      await listen(TRACK_MAP_CLEAR, () => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.trackMapWidget.clearTrackShape();
        });
      })
    );

    this.unlistens.push(
      await listen<ReferenceLapData>(SIM_REFERENCE_LAP_UPDATED, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.referenceLap.updateReferenceLap(event.payload);
        });
      })
    );

    this.unlistens.push(
      await listen<CapabilitiesPayload>(SIM_CAPABILITIES, (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('capabilities received: %o', event.payload);
        runInAction(() => {
          this.capabilities = event.payload;
        });
      })
    );
  }

  private disposeListeners() {
    for (const unsub of this.unlistens) {
      unsub();
    }

    this.unlistens = [];
  }
}

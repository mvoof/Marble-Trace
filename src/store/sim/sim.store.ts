import {
  comparer,
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';
import { listenTo, type UnlistenFn } from '@/services/events.service';

import {
  getConnectionStatus,
  getLastSessionInfo,
  setActiveEventsSilent,
  startTelemetryStream,
  stopTelemetryStream,
} from '@/services/telemetry.service';
import {
  deleteReferenceLap,
  getCachedTrackShape,
  getReferenceLap,
} from '@/services/track.service';

import type {
  SessionSnapshot,
  TrackShapePayload,
  WeatherForecastEntry,
  TelemetryBundle,
  SimType,
  SimStatus,
  CapabilitiesPayload,
  ReferenceLapData,
  TrackCondition,
} from '@/types/bindings';
import { debug } from '@store/sim/debug';
import {
  nextTrackCondition,
  trackConditionForWetness,
} from '@store/sim/track-condition';
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

  /** Condition the currently loaded reference lap was asked for. */
  private referenceCondition: TrackCondition | null = null;
  private initId = 0;
  private unlistens: UnlistenFn[] = [];
  private readonly disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  init() {
    if (
      typeof window !== 'undefined' &&
      !window.location.hash.includes('overlay')
    ) {
      this.disposers.push(
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
        )
      );
    }

    this.disposers.push(
      reaction(
        () => {
          const info = this.root.session.sessionInfo;
          const car = info?.cars.find(
            (entry) => entry.carIdx === info.playerCarIdx
          );

          return info && car
            ? {
                trackId: info.trackId,
                carScreenName: car.carScreenName,
                // The condition is part of the reference's identity: when the
                // track turns wet mid-session the dry reference stops being the
                // right target and the wet one has to be loaded in its place.
                trackWetness:
                  this.root.environment.environment?.track_wetness ?? null,
              }
            : null;
        },
        (identity, previousIdentity) => {
          if (!identity) {
            this.referenceCondition = null;
            this.root.referenceLap.reset();

            return;
          }

          const sameCar =
            previousIdentity !== undefined &&
            previousIdentity !== null &&
            previousIdentity.trackId === identity.trackId &&
            previousIdentity.carScreenName === identity.carScreenName;

          const condition = sameCar
            ? nextTrackCondition(this.referenceCondition, identity.trackWetness)
            : trackConditionForWetness(identity.trackWetness);

          if (sameCar && condition === this.referenceCondition) {
            return;
          }

          this.referenceCondition = condition;

          void this.loadReferenceLap(
            identity.trackId,
            identity.carScreenName,
            condition
          );
        },
        { fireImmediately: true, equals: comparer.shallow }
      )
    );
  }

  // Every RootStore instance creates its own reactions; without this they
  // outlive the store that owns them.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.disposeListeners();
  }

  private async loadReferenceLap(
    trackId: number,
    carScreenName: string,
    condition: TrackCondition
  ) {
    this.root.referenceLap.reset();

    try {
      const data = await getReferenceLap(trackId, carScreenName, condition);

      if (data) {
        runInAction(() => this.root.referenceLap.updateReferenceLap(data));
      }
    } catch (err) {
      debug.telemetry('Failed to load reference lap: %o', err);
    }
  }

  async deleteReferenceLap(trackId: number, carScreenName: string) {
    await deleteReferenceLap(trackId, carScreenName);

    this.root.referenceLap.reset();
  }

  private updateActiveEvents() {
    const widgets = this.root.widgetSettings.allWidgets;
    const hideAll = this.root.appSettings.appSettings.hideAllWidgets;

    let mask = 0;

    if (!hideAll) {
      const isEnabled = (id: string) =>
        widgets.find((w) => w.id === id)?.userSettings.enabled ?? false;

      if (
        isEnabled('g-meter') ||
        isEnabled('weather') ||
        isEnabled('track-map') ||
        isEnabled('race-dash')
      ) {
        mask |= EVENT_CAR_DYNAMICS;
      }

      if (isEnabled('input-trace') || isEnabled('race-dash')) {
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

    setActiveEventsSilent(mask);
  }

  async startStream() {
    const currentId = ++this.initId;

    this.disposeListeners();

    try {
      await stopTelemetryStream();
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
      const initialInfo = await getLastSessionInfo();

      if (initialInfo && this.initId === currentId) {
        this.root.session.updateSessionInfo(initialInfo);
      }

      await this.hydrateTrackShape(currentId);

      await startTelemetryStream();

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
      await stopTelemetryStream();
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
        getConnectionStatus(),
        getLastSessionInfo(),
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

      await this.hydrateTrackShape(this.initId);
    } catch (err) {
      debug.telemetry('Failed to fetch initial status: %o', err);
    }
  }

  // `sim://track-shape` is emitted once per track change, so a window that
  // subscribed after that emit never receives the cached map and would sit on
  // the recording overlay. Pull it explicitly on startup.
  private async hydrateTrackShape(guardId: number) {
    try {
      const cachedShape = await getCachedTrackShape();

      if (!cachedShape || this.initId !== guardId) return;

      runInAction(() => {
        this.root.trackMapWidget.onTrackShapeReceived(cachedShape);
      });
    } catch (err) {
      debug.telemetry('Failed to hydrate cached track shape: %o', err);
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
    this.root.paceCar.reset();
    // Owns timers keyed off telemetry transitions — without a reset the stop
    // clock keeps ticking after the last frame that could have stopped it.
    this.root.pitServiceWidget.reset();
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
      await listenTo<TelemetryBundle>(SIM_TELEMETRY_BUNDLE, (event) => {
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
          if (b.pit_service) this.root.player.updatePitService(b.pit_service);

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
      await listenTo<SessionSnapshot>(SIM_SESSION, (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('session info received: %o', event.payload);
        this.root.session.updateSessionInfo(event.payload);
      })
    );

    this.unlistens.push(
      await listenTo<SimStatus>(SIM_STATUS, (event) => {
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
      await listenTo(SIM_DISCONNECTED, () => {
        if (this.initId !== guardId) return;

        debug.telemetry('stream disconnected');

        this.setDisconnected();
      })
    );

    this.unlistens.push(
      await listenTo<WeatherForecastEntry[]>(SIM_WEATHER, (event) => {
        if (this.initId !== guardId) return;

        this.root.environment.updateWeatherForecast(event.payload);
      })
    );

    this.unlistens.push(
      await listenTo<TrackShapePayload>(SIM_TRACK_SHAPE, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.trackMapWidget.onTrackShapeReceived(event.payload);
        });
      })
    );

    this.unlistens.push(
      await listenTo(TRACK_MAP_CLEAR, () => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.trackMapWidget.clearTrackShape();
        });
      })
    );

    this.unlistens.push(
      await listenTo<ReferenceLapData>(SIM_REFERENCE_LAP_UPDATED, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() => {
          this.root.referenceLap.updateReferenceLap(event.payload);
        });
      })
    );

    this.unlistens.push(
      await listenTo<CapabilitiesPayload>(SIM_CAPABILITIES, (event) => {
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

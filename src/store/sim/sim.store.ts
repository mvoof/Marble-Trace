import {
  comparer,
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';
import { listenTo, type UnlistenFn } from '@platform/services/events.service';

import {
  getConnectionStatus,
  getLastSessionInfo,
  setActiveEventsSilent,
  startTelemetryStream,
  stopTelemetryStream,
} from '@platform/services/telemetry.service';
import {
  deleteReferenceLap,
  getCachedTrackShape,
  getReferenceLap,
} from '@platform/services/track.service';

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
  SimPerfFrame,
  TelemetrySlowBundle,
} from '@/types/bindings';
import { applyTelemetryBundle } from '@store/sim/apply-bundle';
import { debug } from '@store/sim/debug';
import {
  nextTrackCondition,
  trackConditionForWetness,
} from '@store/sim/track-condition';
import type { TelemetryStatus } from '@/types';
import {
  telemetryEventsToMask,
  type TelemetryEventName,
} from '@/types/telemetry-events';
import { WIDGET_BY_ID } from '@store/widget-catalog';
import type { RootStore } from '@store/root-store';
import {
  SIM_TELEMETRY_BUNDLE,
  SIM_SESSION,
  SIM_WEATHER,
  SIM_STATUS,
  SIM_PERF,
  SIM_TELEMETRY_SLOW,
  SIM_DISCONNECTED,
  SIM_TRACK_SHAPE,
  SIM_CAPABILITIES,
  SIM_REFERENCE_LAP_UPDATED,
  TRACK_MAP_CLEAR,
} from '@platform/sync/sim-events';

/**
 * True in the overlay windows, which are the only ones that render widgets and
 * therefore the only ones that need 60 Hz telemetry.
 */
const drawsWidgets = () =>
  typeof window !== 'undefined' && window.location.hash.includes('overlay');

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
    if (!drawsWidgets()) {
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

  /**
   * Rebuilds the mask of high-frequency bundle fields the backend has to fill.
   *
   * The answer comes from the manifests: every enabled widget of the active
   * layout contributes its own `telemetryEvents`, so a widget declares its
   * appetite next to itself and nothing here has to be kept in step with it.
   * Hiding everything asks for nothing at all.
   */
  private updateActiveEvents() {
    const hideAll = this.root.appSettings.appSettings.hideAllWidgets;

    if (hideAll) {
      setActiveEventsSilent(0);

      return;
    }

    const requested = new Set<TelemetryEventName>();

    for (const widget of this.root.widgetSettings.allWidgets) {
      if (!widget.userSettings.enabled) continue;

      const manifest = WIDGET_BY_ID.get(widget.id);

      for (const event of manifest?.telemetryEvents ?? []) {
        requested.add(event);
      }
    }

    setActiveEventsSilent(telemetryEventsToMask(requested));
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
    this.root.simPerf.reset();
    this.root.backendComputed.reset();
    this.root.drivingCoachWidget.reset();
    this.root.paceCar.reset();
    // Owns timers keyed off telemetry transitions — without a reset the stop
    // clock keeps ticking after the last frame that could have stopped it.
    this.root.pitServiceWidget.reset();
  }

  /**
   * Entry points for a remote screen, whose frames arrive over a WebSocket
   * instead of the Tauri event bus. The state transitions are the same ones the
   * listeners drive — only the transport differs, so the private setters stay
   * private and this is the whole surface a remote client touches.
   */
  markRemoteFrame() {
    runInAction(() => this.onFrameReceived());
  }

  applyRemoteStatus(payload: SimStatus) {
    runInAction(() => {
      this.currentSim = payload.sim;
      this.setStatus(payload.status as TelemetryStatus);
    });
  }

  applyRemoteDisconnected() {
    runInAction(() => this.setDisconnected());
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
    await this.subscribeBundle(guardId);

    this.unlistens.push(
      await listenTo<SessionSnapshot>(SIM_SESSION, (event) => {
        if (this.initId !== guardId) return;

        debug.telemetry('session info received: %o', event.payload);
        this.root.session.updateSessionInfo(event.payload);
      })
    );

    await this.subscribeSlowBundle(guardId);

    this.unlistens.push(
      await listenTo<SimPerfFrame>(SIM_PERF, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() => this.root.simPerf.updateSimPerf(event.payload));
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

  /**
   * Subscribes to the 60 Hz bundle only in windows that draw widgets.
   *
   * Tauri delivers an event solely to webviews holding a listener for it, so a
   * window that never subscribes pays nothing: no IPC, no JSON parse, no store
   * writes. The main window renders no widgets, reads connection state from
   * `sim://status` and the sim's counters from `sim://perf`, so while the user
   * is racing it has no use for 60 bundles a second.
   */
  private async subscribeBundle(guardId: number) {
    if (!drawsWidgets()) {
      return;
    }

    this.unlistens.push(
      await listenTo<TelemetryBundle>(SIM_TELEMETRY_BUNDLE, (event) => {
        if (this.initId !== guardId) return;

        applyTelemetryBundle(this.root, event.payload, () =>
          this.onFrameReceived()
        );
      })
    );
  }

  /**
   * Subscribes a window that is off the bundle to the 4 Hz slice instead.
   *
   * Not drawing widgets is not the same as needing no telemetry: the main
   * window runs the hotkey runner and the automatic pit order, and both decide
   * off the sim rather than off settings — the fuel calculation, what the sim
   * has on the order, where the car is on pit road — while layout
   * auto-switching reads `is_on_track`. Without these it answers a key press
   * with an order that silently leaves the fuel out.
   *
   * Four flat frames at 4 Hz, no per-car arrays: on the order of one percent of
   * what the bundle costs, so the point of staying off the bundle survives.
   *
   * One owner, two transports — these call the same setters the bundle path
   * calls, and only one of the two is ever subscribed, so nothing writes twice.
   */
  private async subscribeSlowBundle(guardId: number) {
    if (drawsWidgets()) {
      return;
    }

    this.unlistens.push(
      await listenTo<TelemetrySlowBundle>(SIM_TELEMETRY_SLOW, (event) => {
        if (this.initId !== guardId) return;

        const slow = event.payload;

        runInAction(() => {
          this.root.player.updateCarStatus(slow.car_status);
          this.root.player.updateLapTiming(slow.lap_timing);
          this.root.player.updatePitService(slow.pit_service);

          this.root.backendComputed.updateSlowCarClassCount(
            slow.car_class_count
          );

          if (slow.fuel) {
            this.root.backendComputed.updateFuel(slow.fuel);
          }
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

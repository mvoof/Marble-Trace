import {
  comparer,
  makeAutoObservable,
  reaction,
  runInAction,
  type IReactionDisposer,
} from 'mobx';
import { listenTo, type UnlistenFn } from '@shared/api/events.service';
import { maskOfWidgets } from '@store/sim/telemetry-mask';

import {
  clearActiveEventsSilent,
  clearRemoteActiveEventsSilent,
  getConnectionStatus,
  getLastSessionInfo,
  setActiveEventsSilent,
  setRemoteActiveEventsSilent,
  startTelemetryStream,
  stopTelemetryStream,
} from '@shared/api/telemetry.service';
import {
  watchMinimized,
  type StopWatching,
} from '@shared/api/window-visibility.service';
import {
  deleteReferenceLap,
  getCachedTrackShape,
  getActiveReferenceLap,
} from '@shared/api/track.service';

import type {
  SessionSnapshot,
  TrackShapePayload,
  WeatherForecastEntry,
  TelemetryBundle,
  SimType,
  SimStatus,
  CapabilitiesPayload,
  ReferenceLapData,
  SimPerfFrame,
  TelemetrySlowBundle,
} from '@shared/contracts/bindings';
import { applyTelemetryBundle } from '@store/sim/apply-bundle';
import { debug } from '@store/sim/debug';
import type { TelemetryStatus } from '@/types';
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
} from '@platform/sync/sim-events';
import type { AppSettingsStore } from '@store/settings/app-settings.store';
import type { BackendComputedStore } from '@store/data/computed.store';
import type { CarsStore } from '@store/data/cars.store';
import type { EnvironmentStore } from '@store/data/environment.store';
import type { LiveWidgetsView } from '@store/layout/live-widgets.store';
import type { PitServiceWidgetStore } from '@store/widgets/pit-service/pit-service.store';
import type { PlayerStore } from '@store/data/player.store';
import type { ReferenceLapStore } from '@store/data/reference-lap.store';
import type { SessionStore } from '@store/data/session.store';
import type { SimPerfStore } from '@store/data/sim-perf.store';
import type { TrackMapWidgetStore } from '@store/widgets/track-map/track-map.store';

interface SimDeps {
  appSettings: AppSettingsStore;
  backendComputed: BackendComputedStore;
  cars: CarsStore;
  environment: EnvironmentStore;
  liveWidgets: LiveWidgetsView;
  pitServiceWidget: PitServiceWidgetStore;
  player: PlayerStore;
  referenceLap: ReferenceLapStore;
  session: SessionStore;
  simPerf: SimPerfStore;
  trackMapWidget: TrackMapWidgetStore;
}

/** The page every overlay window loads (`overlay-windows.ts`). */
const OVERLAY_PAGE = '/overlay.html';

/**
 * True in the overlay windows, which are the only ones that render widgets and
 * therefore the only ones that need 60 Hz telemetry.
 */
const drawsWidgets = () =>
  typeof window !== 'undefined' &&
  window.location.pathname.endsWith(OVERLAY_PAGE);

/**
 * Told how long one bundle took to apply, and whether it was a 1 Hz full
 * bundle. Installed only for a perf run.
 */
export type BundleApplyProbe = (durationMs: number, isFull: boolean) => void;

export class SimStore {
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  currentSim: SimType | null = null;
  /**
   * The tape a `dev` build plays instead of the sim, by file name. The status
   * still reads `connected` so the app behaves as live; this is what lets the
   * main window say it is not.
   */
  replayTape: string | null = null;
  capabilities: CapabilitiesPayload | null = null;
  error: string | null = null;
  frameCount = 0;
  /**
   * A perf run in stores-only mode: telemetry is received and applied as
   * usual, but the overlay mounts no widget, so the transport's share of the
   * cost reads off an A/B against a run with widgets.
   */
  widgetsSuppressed = false;
  bundleApplyProbe: BundleApplyProbe | null = null;

  /**
   * True while this window is minimized — one of the three states that take it
   * out of the mask registry entirely. Watched only in the overlay windows.
   */
  private isMinimized = false;
  private stopWatchingMinimized: StopWatching | null = null;
  private isDisposed = false;
  private initId = 0;
  private unlistens: UnlistenFn[] = [];
  private readonly disposers: IReactionDisposer[] = [];

  constructor(private readonly root: SimDeps) {
    makeAutoObservable(this, { bundleApplyProbe: false }, { autoBind: true });
  }

  suppressWidgets() {
    this.widgetsSuppressed = true;
  }

  setBundleApplyProbe(probe: BundleApplyProbe | null) {
    this.bundleApplyProbe = probe;
  }

  init() {
    if (drawsWidgets()) {
      this.disposers.push(
        reaction(
          () => ({
            // What is on screen, not what the editor has open: the editor lives
            // in main and its preview draws against seeded scenarios, so it
            // must contribute nothing. Reading the live layout is also what
            // keeps a session auto-switch moving this window's appetite while
            // the editor holds another layout open.
            widgets: this.root.liveWidgets.liveOwnMonitorWidgets.map(
              (widget) => widget.id
            ),
            gateClosed: this.ownGateClosed,
          }),
          () => this.updateOwnActiveEvents(),
          { fireImmediately: true, equals: comparer.structural }
        )
      );

      void watchMinimized((minimized) =>
        runInAction(() => {
          this.isMinimized = minimized;
        })
      ).then((stop) => {
        // The store can be disposed before the listener is in place.
        if (this.isDisposed) {
          stop();

          return;
        }

        this.stopWatchingMinimized = stop;
      });
    } else {
      this.disposers.push(
        reaction(
          () => ({
            widgets: this.root.liveWidgets.liveRemoteScreenWidgets.map(
              (widget) => ({
                id: widget.id,
                enabled: widget.userSettings.enabled,
              })
            ),
            gateClosed: this.remoteGateClosed,
          }),
          () => this.updateRemoteActiveEvents(),
          { fireImmediately: true, equals: comparer.structural }
        )
      );
    }
  }

  // Every RendererCore instance creates its own reactions; without this they
  // outlive the store that owns them.
  dispose() {
    for (const disposer of this.disposers) {
      disposer();
    }

    this.disposers.length = 0;
    this.isDisposed = true;
    this.stopWatchingMinimized?.();
    this.stopWatchingMinimized = null;
    this.disposeListeners();
  }

  /** The reference the telemetry thread made active before this window listened. */
  private async hydrateReferenceLap(guardId: number) {
    try {
      const data = await getActiveReferenceLap();

      if (this.initId !== guardId) return;

      runInAction(() => this.applyActiveReference(data));
    } catch (err) {
      debug.telemetry('Failed to load the active reference lap: %o', err);
    }
  }

  /** The telemetry thread picks the reference; a window only shows it. */
  private applyActiveReference(data: ReferenceLapData | null) {
    if (data) {
      this.root.referenceLap.updateReferenceLap(data);
    } else {
      this.root.referenceLap.reset();
    }
  }

  async deleteReferenceLap(trackId: number, carScreenName: string) {
    await deleteReferenceLap(trackId, carScreenName);

    this.root.referenceLap.reset();
  }

  /**
   * Whether the app is showing no widgets anywhere — the part of the visibility
   * gate every recipient shares.
   *
   * A recipient behind a closed gate is removed from the registry rather than
   * registered with a mask of `0`: a `0` still names a recipient the ungated
   * bundle is delivered to, and the point is to be sent nothing at all.
   *
   * Loss of focus is deliberately absent: an overlay is unfocused for the whole
   * session, and gating on it would blank every widget exactly when it matters.
   */
  private get everyWidgetHidden(): boolean {
    const settings = this.root.appSettings.appSettings;

    if (settings.hideAllWidgets) {
      return true;
    }

    // Drag mode paints the widgets whatever the sim is doing, so the driver can
    // place them with the game closed — it must keep its telemetry.
    return (
      settings.hideWidgetsWhenGameClosed &&
      this.status !== 'connected' &&
      !this.root.appSettings.dragMode
    );
  }

  /** The shared gate plus the one state that belongs to a window: minimized. */
  private get ownGateClosed(): boolean {
    return this.isMinimized || this.everyWidgetHidden;
  }

  /**
   * The shared gate alone: main's own window being minimized says nothing about
   * a tablet on the LAN.
   */
  private get remoteGateClosed(): boolean {
    return this.everyWidgetHidden;
  }

  /**
   * Registers this window's own appetite for the gated bundle fields.
   *
   * The mask is the union of what the enabled widgets **on this window's
   * monitor** declare in their manifests — the same set the canvas draws — so a
   * widget states its appetite next to itself and the window that renders it is
   * the one that asks for it. A window showing nothing leaves the registry
   * altogether, so even the ungated tiers stop arriving.
   */
  private updateOwnActiveEvents() {
    if (this.ownGateClosed) {
      clearActiveEventsSilent();

      return;
    }

    setActiveEventsSilent(
      maskOfWidgets(this.root.liveWidgets.liveOwnMonitorWidgets)
    );
  }

  /**
   * The remote screens have no window of their own to register for them, and
   * main owns remote publishing — so main registers their mask under the
   * reserved pseudo-label.
   */
  private updateRemoteActiveEvents() {
    if (this.remoteGateClosed) {
      clearRemoteActiveEventsSilent();

      return;
    }

    setRemoteActiveEventsSilent(
      maskOfWidgets(this.root.liveWidgets.liveRemoteScreenWidgets)
    );
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
      await this.hydrateReferenceLap(currentId);

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
    this.root.referenceLap.reset();
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
    runInAction(() => this.applyStatus(payload));
  }

  private applyStatus(payload: SimStatus) {
    this.currentSim = payload.sim;
    this.replayTape = payload.replay;
    this.setStatus(payload.status as TelemetryStatus);
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
      this.replayTape = null;
      this.capabilities = null;
      this.resetDataStores();
    }
  }

  private setError(error: string) {
    this.error = error;
    this.isConnected = false;
    this.status = 'error';
    this.currentSim = null;
    this.replayTape = null;
    this.capabilities = null;
  }

  private setDisconnected() {
    this.isConnected = false;
    this.status = 'disconnected';
    this.currentSim = null;
    this.replayTape = null;
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
        runInAction(() => this.applyStatus(payload));
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
      await listenTo<ReferenceLapData | null>(
        SIM_REFERENCE_LAP_UPDATED,
        (event) => {
          if (this.initId !== guardId) return;

          runInAction(() => this.applyActiveReference(event.payload));
        }
      )
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

        const probe = this.bundleApplyProbe;
        const started = probe ? performance.now() : 0;

        applyTelemetryBundle(this.root, event.payload, () =>
          this.onFrameReceived()
        );

        if (probe) {
          probe(performance.now() - started, Boolean(event.payload.session));
        }
      })
    );
  }

  /**
   * Subscribes a window that is off the bundle to the 4 Hz slice instead: the
   * car status, whose `is_on_track` the layout auto-switch reads. Everything
   * that decides on the sim — the hotkeys, the pit orders — runs on the
   * telemetry thread and needs no frame here.
   *
   * One owner, two transports — the same setter the bundle path calls, and only
   * one of the two is ever subscribed, so nothing writes twice.
   */
  private async subscribeSlowBundle(guardId: number) {
    if (drawsWidgets()) {
      return;
    }

    this.unlistens.push(
      await listenTo<TelemetrySlowBundle>(SIM_TELEMETRY_SLOW, (event) => {
        if (this.initId !== guardId) return;

        runInAction(() =>
          this.root.player.updateCarStatus(event.payload.carStatus)
        );
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

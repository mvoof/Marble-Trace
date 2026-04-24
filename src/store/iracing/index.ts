import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  CarDynamicsFrame,
  CarIdxFrame,
  CarInputsFrame,
  CarStatusFrame,
  ChassisFrame,
  DriverEntriesFrame,
  EnvironmentFrame,
  FuelComputedFrame,
  LapDeltaFrame,
  LapTimingFrame,
  PitStopsFrame,
  ProximityFrame,
  SessionFrame,
  SessionInfo,
} from '../../types/bindings';
import { debug } from '../../utils/debug';

import { telemetryStore } from './telemetry.store';
import { computedStore } from './computed.store';

export type TelemetryStatus =
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

class TelemetryConnection {
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  error: string | null = null;
  frameCount = 0;

  private initId = 0;
  private unlistens: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
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
      await listen<CarDynamicsFrame>(
        'iracing://telemetry/car-dynamics',
        (event) => {
          if (this.initId !== guardId) return;

          if (this.frameCount % 60 === 0) {
            debug.telemetry('frame #%d', this.frameCount);
          }

          this.onFrameReceived();
          telemetryStore.updateCarDynamics(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<CarIdxFrame>('iracing://telemetry/car-idx', (event) => {
        if (this.initId !== guardId) return;
        telemetryStore.updateCarIdx(event.payload);
      })
    );

    this.unlistens.push(
      await listen<CarInputsFrame>(
        'iracing://telemetry/car-inputs',
        (event) => {
          if (this.initId !== guardId) return;
          telemetryStore.updateCarInputs(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<CarStatusFrame>(
        'iracing://telemetry/car-status',
        (event) => {
          if (this.initId !== guardId) return;
          telemetryStore.updateCarStatus(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<LapTimingFrame>(
        'iracing://telemetry/lap-timing',
        (event) => {
          if (this.initId !== guardId) return;
          telemetryStore.updateLapTiming(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<SessionFrame>('iracing://telemetry/session', (event) => {
        if (this.initId !== guardId) return;
        telemetryStore.updateSession(event.payload);
      })
    );

    this.unlistens.push(
      await listen<EnvironmentFrame>(
        'iracing://telemetry/environment',
        (event) => {
          if (this.initId !== guardId) return;
          telemetryStore.updateEnvironment(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<ChassisFrame>('iracing://telemetry/chassis', (event) => {
        if (this.initId !== guardId) return;
        telemetryStore.updateChassis(event.payload);
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
      await listen<ProximityFrame>('iracing://computed/proximity', (event) => {
        if (this.initId !== guardId) return;
        computedStore.updateProximity(event.payload);
      })
    );

    this.unlistens.push(
      await listen<FuelComputedFrame>('iracing://computed/fuel', (event) => {
        if (this.initId !== guardId) return;
        computedStore.updateFuel(event.payload);
      })
    );

    this.unlistens.push(
      await listen<DriverEntriesFrame>(
        'iracing://computed/standings',
        (event) => {
          if (this.initId !== guardId) return;
          computedStore.updateStandings(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<PitStopsFrame>('iracing://computed/pit-stops', (event) => {
        if (this.initId !== guardId) return;
        computedStore.updatePitStops(event.payload);
      })
    );

    this.unlistens.push(
      await listen<LapDeltaFrame>('iracing://computed/lap-delta', (event) => {
        if (this.initId !== guardId) return;
        computedStore.updateLapDelta(event.payload);
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

export const telemetryConnectionStore = new TelemetryConnection();

export { telemetryStore } from './telemetry.store';
export { computedStore } from './computed.store';

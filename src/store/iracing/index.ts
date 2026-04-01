/**
 * iRacing telemetry connection orchestrator.
 *
 * Manages the lifecycle of all iRacing telemetry event listeners:
 * - Subscribes to 6 domain telemetry events + session info + status events
 * - Routes each event payload to the appropriate MobX store
 * - Provides startStream/stopStream for main window, startWidgetListener/stopWidgetListener for widgets
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/
 * @see https://sajax.github.io/irsdkdocs/yaml/
 */
import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  CarDynamicsFrame,
  CarInputsFrame,
  CarStatusFrame,
  EnvironmentFrame,
  LapTimingFrame,
  SessionFrame,
  SessionInfo,
} from '../../types/bindings';
import { debug } from '../../utils/debug';

import { carDynamicsStore } from './car-dynamics.store';
import { carInputsStore } from './car-inputs.store';
import { carStatusStore } from './car-status.store';
import { environmentStore } from './environment.store';
import { lapTimingStore } from './lap-timing.store';
import { sessionStore } from './session.store';

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
        sessionStore.updateSessionInfo(initialInfo);
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
        sessionStore.updateSessionInfo(initialInfo);
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
      this.resetAllStores();
    } else if (status === 'disconnected') {
      this.isConnected = false;
      this.resetAllStores();
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
    this.resetAllStores();
  }

  private onFrameReceived() {
    this.frameCount++;
    this.isConnected = true;
    this.status = 'connected';
    this.error = null;
  }

  private resetAllStores() {
    carDynamicsStore.reset();
    carInputsStore.reset();
    carStatusStore.reset();
    lapTimingStore.reset();
    sessionStore.reset();
    environmentStore.reset();
  }

  /** Subscribe to all iRacing telemetry events */
  private async subscribeAllEvents(guardId: number) {
    // Domain telemetry events
    this.unlistens.push(
      await listen<CarDynamicsFrame>(
        'iracing://telemetry/car-dynamics',
        (event) => {
          if (this.initId !== guardId) return;

          if (this.frameCount % 60 === 0) {
            debug.telemetry('frame #%d', this.frameCount);
          }

          this.onFrameReceived();
          carDynamicsStore.updateFrame(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<CarInputsFrame>(
        'iracing://telemetry/car-inputs',
        (event) => {
          if (this.initId !== guardId) return;
          carInputsStore.updateFrame(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<CarStatusFrame>(
        'iracing://telemetry/car-status',
        (event) => {
          if (this.initId !== guardId) return;
          carStatusStore.updateFrame(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<LapTimingFrame>(
        'iracing://telemetry/lap-timing',
        (event) => {
          if (this.initId !== guardId) return;
          lapTimingStore.updateFrame(event.payload);
        }
      )
    );

    this.unlistens.push(
      await listen<SessionFrame>('iracing://telemetry/session', (event) => {
        if (this.initId !== guardId) return;
        sessionStore.updateFrame(event.payload);
      })
    );

    this.unlistens.push(
      await listen<EnvironmentFrame>(
        'iracing://telemetry/environment',
        (event) => {
          if (this.initId !== guardId) return;
          environmentStore.updateFrame(event.payload);
        }
      )
    );

    // Session info (YAML, on change)
    this.unlistens.push(
      await listen<SessionInfo>('iracing://session-info', (event) => {
        if (this.initId !== guardId) return;
        debug.telemetry('session info received: %o', event.payload);
        sessionStore.updateSessionInfo(event.payload);
      })
    );

    // Connection status
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
  }

  private disposeListeners() {
    for (const unsub of this.unlistens) {
      unsub();
    }
    this.unlistens = [];
  }
}

/** Singleton connection orchestrator */
export const telemetryConnection = new TelemetryConnection();

// Re-export all domain stores
export { carDynamicsStore } from './car-dynamics.store';
export { carInputsStore } from './car-inputs.store';
export { carStatusStore } from './car-status.store';
export { environmentStore } from './environment.store';
export { lapTimingStore } from './lap-timing.store';
export { sessionStore } from './session.store';

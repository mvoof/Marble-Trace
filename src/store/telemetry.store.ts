import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { TelemetryFrame } from '../types/bindings';
import { debug } from '../utils/debug';

export interface DriverInfo {
  DriverCarRedLine: number | null;
  DriverCarIdleRPM: number | null;
  DriverCarSLFirstRPM: number | null;
  DriverCarSLShiftRPM: number | null;
  DriverCarSLLastRPM: number | null;
  DriverCarSLBlinkRPM: number | null;
  DriverCarFuelMaxLtr: number | null;
  DriverCarGearNumForward: number | null;
}

export type TelemetryStatus =
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

class TelemetryStore {
  frame: TelemetryFrame | null = null;
  driverInfo: DriverInfo | null = null;
  isConnected = false;
  status: TelemetryStatus = 'waiting';
  error: string | null = null;
  frameCount = 0;

  private initId = 0;
  private unlistens: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
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

    this.unlistens.push(
      await listen<TelemetryFrame>('telemetry-frame-event', (event) => {
        if (this.frameCount % 60 === 0) {
          debug.telemetry('frame #%d', this.frameCount);
        }
        this.updateFrame(event.payload);
      })
    );

    if (this.initId !== currentId) {
      this.disposeListeners();
      return;
    }

    this.unlistens.push(
      await listen('telemetry-disconnected-event', () => {
        if (this.initId === currentId) {
          debug.telemetry('stream disconnected');
          this.setDisconnected();
        }
      })
    );

    this.unlistens.push(
      await listen<string>('telemetry-status-event', (event) => {
        if (this.initId === currentId) {
          debug.telemetry('status: %s', event.payload);
          this.setStatus(event.payload as TelemetryStatus);
        }
      })
    );

    this.unlistens.push(
      await listen<DriverInfo>('session-driver-info-event', (event) => {
        if (this.initId === currentId) {
          debug.telemetry('driver info received: %o', event.payload);
          this.updateDriverInfo(event.payload);
        }
      })
    );

    debug.telemetry('starting stream...');

    try {
      // Fetch initial driver info if available
      const initialInfo = await invoke<DriverInfo | null>(
        'get_last_driver_info'
      );
      if (initialInfo && this.initId === currentId) {
        this.updateDriverInfo(initialInfo);
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

  /** Widget windows: listen-only, no stream start/stop */
  async startWidgetListener() {
    this.disposeListeners();

    this.unlistens.push(
      await listen<TelemetryFrame>('telemetry-frame-event', (event) => {
        if (this.frameCount % 60 === 0) {
          debug.telemetry('[widget] frame #%d', this.frameCount);
        }
        this.updateFrame(event.payload);
      })
    );

    this.unlistens.push(
      await listen('telemetry-disconnected-event', () => {
        debug.telemetry('[widget] stream disconnected');
        this.setDisconnected();
      })
    );

    this.unlistens.push(
      await listen<string>('telemetry-status-event', (event) => {
        debug.telemetry('[widget] status: %s', event.payload);
        this.setStatus(event.payload as TelemetryStatus);
      })
    );

    this.unlistens.push(
      await listen<DriverInfo>('session-driver-info-event', (event) => {
        debug.telemetry('[widget] driver info: %o', event.payload);
        this.updateDriverInfo(event.payload);
      })
    );

    // Fetch initial driver info if available
    try {
      const initialInfo = await invoke<DriverInfo | null>(
        'get_last_driver_info'
      );
      if (initialInfo) {
        this.updateDriverInfo(initialInfo);
      }
    } catch (err) {
      debug.telemetry('Failed to fetch initial driver info: %o', err);
    }
  }

  stopWidgetListener() {
    this.disposeListeners();
  }

  updateDriverInfo(info: DriverInfo) {
    this.driverInfo = info;
  }

  updateFrame(frame: TelemetryFrame) {
    this.frame = frame;
    this.isConnected = true;
    this.status = 'connected';
    this.error = null;
    this.frameCount++;
  }

  setStatus(status: TelemetryStatus) {
    this.status = status;

    if (status === 'connected') {
      this.isConnected = true;
      this.error = null;
    } else if (status === 'waiting') {
      this.isConnected = false;
      this.frame = null;
    } else if (status === 'disconnected') {
      this.isConnected = false;
      this.frame = null;
    }
  }

  setError(error: string) {
    this.error = error;
    this.isConnected = false;
    this.status = 'error';
  }

  setDisconnected() {
    this.isConnected = false;
    this.status = 'disconnected';
    this.frame = null;
    this.driverInfo = null;
  }

  private disposeListeners() {
    for (const unsub of this.unlistens) {
      unsub();
    }
    this.unlistens = [];
  }
}

export const telemetryStore = new TelemetryStore();

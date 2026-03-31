import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { TelemetryFrame } from '../types/bindings';
import { debug } from '../utils/debug';

export type TelemetryStatus =
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

class TelemetryStore {
  frame: TelemetryFrame | null = null;
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

    debug.telemetry('starting stream...');

    try {
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
  }

  stopWidgetListener() {
    this.disposeListeners();
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
  }

  private disposeListeners() {
    for (const unsub of this.unlistens) {
      unsub();
    }
    this.unlistens = [];
  }
}

export const telemetryStore = new TelemetryStore();

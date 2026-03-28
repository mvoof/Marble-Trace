import { makeAutoObservable } from 'mobx';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { TelemetryFrame } from '../types/bindings';

class TelemetryStore {
  frame: TelemetryFrame | null = null;
  isConnected = false;
  error: string | null = null;
  frameCount = 0;

  private initId = 0;
  private unlisten: UnlistenFn | null = null;
  private unlistenDebug: UnlistenFn | null = null;
  private unlistenDisconnect: UnlistenFn | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async startStream() {
    const currentId = ++this.initId;

    this.unlisten?.();
    this.unlisten = null;

    try {
      await invoke('stop_telemetry_stream');
    } catch {
      // ignore
    }

    if (this.initId !== currentId) return;

    this.unlisten = await listen<TelemetryFrame>(
      'telemetry-frame-event',
      (event) => {
        if (this.frameCount % 60 === 0) {
          console.log('[Telemetry] frame #%d:', this.frameCount, event.payload);
        }
        this.updateFrame(event.payload);
      }
    );

    if (this.initId !== currentId) {
      this.unlisten();
      this.unlisten = null;
      return;
    }

    this.unlistenDebug?.();
    this.unlistenDebug = await listen<string>(
      'telemetry-debug-event',
      (event) => {
        console.log('[Telemetry Rust]', event.payload);
      }
    );

    this.unlistenDisconnect?.();
    this.unlistenDisconnect = await listen(
      'telemetry-disconnected-event',
      () => {
        if (this.initId === currentId) {
          console.log(
            '[Telemetry] Stream disconnected (game closed or stream ended)'
          );
          this.setDisconnected();
        }
      }
    );

    console.log('[Telemetry] Starting telemetry stream...');

    try {
      await invoke('start_telemetry_stream');

      if (this.initId === currentId) {
        console.log('[Telemetry] Stream started');
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
    this.unlisten?.();
    this.unlisten = null;
    this.unlistenDebug?.();
    this.unlistenDebug = null;
    this.unlistenDisconnect?.();
    this.unlistenDisconnect = null;

    try {
      await invoke('stop_telemetry_stream');
    } catch {
      // ignore
    }

    this.setDisconnected();
  }

  /** Widget windows: listen-only, no stream start/stop */
  async startWidgetListener() {
    this.unlisten?.();
    this.unlisten = await listen<TelemetryFrame>(
      'telemetry-frame-event',
      (event) => {
        if (this.frameCount % 60 === 0) {
          console.log(
            '[Widget Telemetry] frame #%d:',
            this.frameCount,
            event.payload
          );
        }
        this.updateFrame(event.payload);
      }
    );

    this.unlistenDisconnect?.();
    this.unlistenDisconnect = await listen(
      'telemetry-disconnected-event',
      () => {
        console.log('[Widget Telemetry] Stream disconnected');
        this.setDisconnected();
      }
    );
  }

  stopWidgetListener() {
    this.unlisten?.();
    this.unlisten = null;
    this.unlistenDisconnect?.();
    this.unlistenDisconnect = null;
  }

  updateFrame(frame: TelemetryFrame) {
    this.frame = frame;
    this.isConnected = true;
    this.error = null;
    this.frameCount++;
  }

  setError(error: string) {
    this.error = error;
    this.isConnected = false;
  }

  setDisconnected() {
    this.isConnected = false;
    this.frame = null;
  }
}

export const telemetryStore = new TelemetryStore();

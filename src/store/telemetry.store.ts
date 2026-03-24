import { makeAutoObservable } from 'mobx';
import { UnlistenFn } from '@tauri-apps/api/event';

import { commands, events, type TelemetryFrame } from '../bindings';

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
      await commands.stopTelemetryStream();
    } catch {
      // ignore
    }

    if (this.initId !== currentId) return;

    this.unlisten = await events.telemetryFrameEvent.listen((event) => {
      if (this.frameCount % 60 === 0) {
        console.log('[Telemetry] frame #%d:', this.frameCount, event.payload);
      }
      this.updateFrame(event.payload);
    });

    if (this.initId !== currentId) {
      this.unlisten();
      this.unlisten = null;
      return;
    }

    this.unlistenDebug?.();
    this.unlistenDebug = await events.telemetryDebugEvent.listen((event) => {
      console.log('[Telemetry Rust]', event.payload);
    });

    this.unlistenDisconnect?.();
    this.unlistenDisconnect = await events.telemetryDisconnectedEvent.listen(
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
      await commands.startTelemetryStream();

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
      await commands.stopTelemetryStream();
    } catch {
      // ignore
    }

    this.setDisconnected();
  }

  /** Widget windows: listen-only, no stream start/stop */
  async startWidgetListener() {
    this.unlisten?.();
    this.unlisten = await events.telemetryFrameEvent.listen((event) => {
      if (this.frameCount % 60 === 0) {
        console.log(
          '[Widget Telemetry] frame #%d:',
          this.frameCount,
          event.payload
        );
      }
      this.updateFrame(event.payload);
    });

    this.unlistenDisconnect?.();
    this.unlistenDisconnect = await events.telemetryDisconnectedEvent.listen(
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

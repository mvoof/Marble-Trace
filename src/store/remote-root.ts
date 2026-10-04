import { RendererCore } from './renderer-core';

/**
 * A remote screen: the renderer core, fed over a WebSocket instead of Tauri.
 *
 * Built with `skipInit` because the core's init opens Tauri channels — the
 * telemetry stream, the settings file, the chat connectors — none of which a
 * browser has. Only the widget stores that derive their state from the data
 * stores are started; everything else arrives over the socket.
 */
export class RemoteRoot extends RendererCore {
  constructor() {
    super({ skipInit: true });

    this.flags.init();
    this.paceCar.init();
    this.radar.init();
    this.drivingCoachWidget.init();
    this.coachWidget.init();
    this.pitServiceWidget.init();
  }
}

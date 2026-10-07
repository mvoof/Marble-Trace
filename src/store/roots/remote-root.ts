import { RendererCore } from './renderer-core';

/**
 * A remote screen: the renderer core, fed over a WebSocket instead of Tauri.
 *
 * Built with `skipInit` because the core's init opens Tauri channels — the
 * telemetry stream, the settings file, the chat connectors — none of which a
 * browser has. The widget stores derive their state from the data stores and
 * start as their widgets mount (`startsWidgetStores`); the pit service, which
 * is app-wide, is started here. Everything else arrives over the socket.
 */
export class RemoteRoot extends RendererCore {
  constructor() {
    super({ skipInit: true, startsWidgetStores: true });

    this.pitServiceWidget.init();
  }
}

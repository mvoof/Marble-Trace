import { makeAutoObservable, runInAction } from 'mobx';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { widgetSettingsStore, WidgetConfig } from './widget-settings.store';

class WindowManagerStore {
  openWindows: Map<string, WebviewWindow> = new Map();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async openWidget(config: WidgetConfig) {
    if (this.openWindows.has(config.id)) return;

    const label = `widget-${config.id}`;
    const webview = new WebviewWindow(label, {
      url: `index.html#/widget/${config.id}`,
      title: config.label,
      width: config.width,
      height: config.height,
      x: config.x,
      y: config.y,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
    });

    runInAction(() => {
      this.openWindows.set(config.id, webview);
    });

    webview.once('tauri://error', (e) => {
      console.error(`Widget window error [${config.id}]:`, e);
      runInAction(() => {
        this.openWindows.delete(config.id);
      });
    });

    webview.onCloseRequested(() => {
      runInAction(() => {
        this.openWindows.delete(config.id);
        widgetSettingsStore.setWidgetEnabled(config.id, false);
      });
    });

    webview.listen('tauri://move', (event) => {
      const { x, y } = event.payload as { x: number; y: number };
      widgetSettingsStore.updatePosition(
        config.id,
        Math.round(x),
        Math.round(y)
      );
    });

    webview.listen('tauri://resize', (event) => {
      const { width, height } = event.payload as {
        width: number;
        height: number;
      };
      widgetSettingsStore.updateSize(
        config.id,
        Math.round(width),
        Math.round(height)
      );
    });
  }

  async closeWidget(id: string) {
    const webview = this.openWindows.get(id);
    if (webview) {
      await webview.destroy();
      runInAction(() => {
        this.openWindows.delete(id);
      });
    }
  }

  async toggleWidget(id: string) {
    if (this.openWindows.has(id)) {
      await this.closeWidget(id);
    } else {
      const config = widgetSettingsStore.getWidget(id);
      if (config) {
        await this.openWidget(config);
      }
    }
  }

  isOpen(id: string): boolean {
    return this.openWindows.has(id);
  }

  async restoreEnabledWidgets() {
    for (const config of widgetSettingsStore.widgets) {
      if (config.enabled) {
        await this.openWidget(config);
      }
    }
  }
}

export const windowManagerStore = new WindowManagerStore();

import { makeAutoObservable, runInAction } from 'mobx';
import { load, Store } from '@tauri-apps/plugin-store';
import { emit, listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  register,
  unregister,
  unregisterAll,
} from '@tauri-apps/plugin-global-shortcut';
import { widgetSettingsStore } from './widget-settings.store';

const DEFAULT_DRAG_HOTKEY = 'F9';

interface AppSettings {
  dragHotkey: string;
  hideWidgetsWhenGameClosed: boolean;
  hideAllWidgets: boolean;
}

class AppSettingsStore {
  dragMode = false;
  dragHotkey: string = DEFAULT_DRAG_HOTKEY;
  hideWidgetsWhenGameClosed = false;
  hideAllWidgets = false;

  private store: Store | null = null;
  private registeredWidgetHotkeys: Map<string, string> = new Map();
  private initId = 0;
  private overlayUnlisten: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async init() {
    const currentId = ++this.initId;

    await unregisterAll();

    if (this.initId !== currentId) return;

    await this.loadSettings();

    if (this.initId !== currentId) return;

    await this.registerDragHotkey();
    if (this.initId !== currentId) return;

    await this.registerAllWidgetHotkeys();
  }

  async loadSettings() {
    this.store = await load('app-settings.json');
    const saved = await this.store.get<AppSettings>('settings');

    runInAction(() => {
      if (saved) {
        this.dragHotkey = saved.dragHotkey || DEFAULT_DRAG_HOTKEY;
        this.hideWidgetsWhenGameClosed =
          saved.hideWidgetsWhenGameClosed ?? false;
        this.hideAllWidgets = saved.hideAllWidgets ?? false;
      }
    });
  }

  toggleDragMode() {
    this.dragMode = !this.dragMode;
    emit('drag-mode-changed', this.dragMode).catch(console.error);
  }

  /** Called by the overlay window to sync dragMode and hideAllWidgets from the main window. */
  async initOverlayListener() {
    this.overlayUnlisten.push(
      await listen<boolean>('drag-mode-changed', (event) => {
        runInAction(() => {
          this.dragMode = event.payload;
        });
      })
    );

    this.overlayUnlisten.push(
      await listen<boolean>('hide-all-widgets-changed', (event) => {
        runInAction(() => {
          this.hideAllWidgets = event.payload;
        });
      })
    );

    this.overlayUnlisten.push(
      await listen<boolean>(
        'hide-widgets-when-game-closed-changed',
        (event) => {
          runInAction(() => {
            this.hideWidgetsWhenGameClosed = event.payload;
          });
        }
      )
    );
  }

  disposeOverlayListener() {
    this.overlayUnlisten.forEach((unlisten) => unlisten());
    this.overlayUnlisten = [];
  }

  async setHideWidgetsWhenGameClosed(value: boolean) {
    this.hideWidgetsWhenGameClosed = value;
    emit('hide-widgets-when-game-closed-changed', value).catch(console.error);
    await this.saveSettings();
  }

  async setHideAllWidgets(value: boolean) {
    this.hideAllWidgets = value;
    emit('hide-all-widgets-changed', this.hideAllWidgets).catch(console.error);
    await this.saveSettings();
  }

  async setDragHotkey(hotkey: string) {
    await this.unregisterKey(this.dragHotkey);
    runInAction(() => {
      this.dragHotkey = hotkey;
    });
    await this.registerDragHotkey();
    await this.saveSettings();
  }

  async registerWidgetHotkey(widgetId: string, hotkey: string) {
    const prev = this.registeredWidgetHotkeys.get(widgetId);
    if (prev) {
      await this.unregisterKey(prev);
    }
    if (!hotkey) return;
    try {
      await this.unregisterKey(hotkey);
      await register(hotkey, (event) => {
        if (event.state === 'Pressed') {
          const widget = widgetSettingsStore.getWidget(widgetId);
          if (widget) {
            widgetSettingsStore.setWidgetEnabled(widgetId, !widget.enabled);
          }
        }
      });
      this.registeredWidgetHotkeys.set(widgetId, hotkey);
    } catch (e) {
      console.error(`Failed to register widget hotkey [${widgetId}]:`, e);
    }
  }

  async unregisterWidgetHotkey(widgetId: string) {
    const hotkey = this.registeredWidgetHotkeys.get(widgetId);
    if (hotkey) {
      await this.unregisterKey(hotkey);
      this.registeredWidgetHotkeys.delete(widgetId);
    }
  }

  async registerAllWidgetHotkeys() {
    for (const widget of widgetSettingsStore.widgets) {
      if (widget.hotkey) {
        await this.registerWidgetHotkey(widget.id, widget.hotkey);
      }
    }
  }

  private async registerDragHotkey() {
    try {
      await this.unregisterKey(this.dragHotkey);
      await register(this.dragHotkey, (event) => {
        if (event.state === 'Pressed') {
          this.toggleDragMode();
        }
      });
    } catch (e) {
      console.error('Failed to register hotkey:', e);
    }
  }

  private async unregisterKey(hotkey: string) {
    try {
      await unregister(hotkey);
    } catch {
      // Ignore — key may not be registered
    }
  }

  private async saveSettings() {
    if (!this.store) return;
    await this.store.set('settings', {
      dragHotkey: this.dragHotkey,
      hideWidgetsWhenGameClosed: this.hideWidgetsWhenGameClosed,
      hideAllWidgets: this.hideAllWidgets,
    });
    await this.store.save();
  }

  async dispose() {
    this.initId++;
    await unregisterAll();
    this.registeredWidgetHotkeys.clear();
  }
}

export const appSettingsStore = new AppSettingsStore();

import { makeAutoObservable } from 'mobx';

const DEFAULT_DRAG_HOTKEY = 'F9';

class AppSettingsStore {
  dragMode = false;
  dragHotkey: string = DEFAULT_DRAG_HOTKEY;
  hideWidgetsWhenGameClosed = false;
  hideAllWidgets = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  toggleDragMode() {
    this.dragMode = !this.dragMode;
  }

  setDragMode(value: boolean) {
    this.dragMode = value;
  }

  setHideWidgetsWhenGameClosed(value: boolean) {
    this.hideWidgetsWhenGameClosed = value;
  }

  setHideAllWidgets(value: boolean) {
    this.hideAllWidgets = value;
  }

  setDragHotkey(hotkey: string) {
    this.dragHotkey = hotkey;
  }
}

export const appSettingsStore = new AppSettingsStore();

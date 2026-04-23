import { makeAutoObservable } from 'mobx';

const DEFAULT_DRAG_HOTKEY = 'F9';
const DEFAULT_HIDE_ALL_HOTKEY = 'F10';

class AppSettingsStore {
  dragMode = false;
  dragHotkey: string = DEFAULT_DRAG_HOTKEY;
  hideWidgetsWhenGameClosed = false;
  hideAllWidgets = false;
  hideAllWidgetsHotkey: string = DEFAULT_HIDE_ALL_HOTKEY;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  toggleDragMode() {
    this.dragMode = !this.dragMode;
  }

  toggleHideAllWidgets() {
    this.hideAllWidgets = !this.hideAllWidgets;
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

  setHideAllWidgetsHotkey(hotkey: string) {
    this.hideAllWidgetsHotkey = hotkey;
  }
}

export const appSettingsStore = new AppSettingsStore();

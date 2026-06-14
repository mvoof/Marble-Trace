import { makeAutoObservable } from 'mobx';

export class WidgetAutoHideStore {
  private visibilityMap = new Map<string, boolean>();

  constructor() {
    makeAutoObservable(this);
  }

  setVisible = (id: string, visible: boolean) => {
    this.visibilityMap.set(id, visible);
  };

  isVisible = (id: string): boolean => {
    return this.visibilityMap.get(id) ?? true;
  };
}

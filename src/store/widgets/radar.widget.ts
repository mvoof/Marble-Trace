import { action, makeAutoObservable, reaction } from 'mobx';

import type { NearbyCar } from '@/types/bindings';
import type { RadarSettings } from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';

export class RadarWidgetStore {
  visible = false;

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  init() {
    reaction(
      () => ({
        hasNearby: this.hasNearby,
        hideDelay: this.hideDelay,
      }),
      ({ hasNearby, hideDelay }) => {
        if (hasNearby) {
          if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
          }

          action(() => {
            this.visible = true;
          })();
        } else {
          if (this.hideTimer) {
            return;
          }

          this.hideTimer = setTimeout(
            action(() => {
              this.visible = false;
              this.hideTimer = null;
            }),
            hideDelay * 1000
          );
        }
      }
    );
  }

  get hasNearby(): boolean {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return false;
    }

    const settings =
      this.root.widgetSettings.getSettings<RadarSettings>('proximity-radar');
    const proximityThreshold = settings.proximityThreshold;
    const hasSpotterContact = proximity.spotterLeft || proximity.spotterRight;

    if (hasSpotterContact) {
      return true;
    }

    return proximity.nearbyCars.some(
      (car) => car.clearance <= proximityThreshold
    );
  }

  private get hideDelay(): number {
    return this.root.widgetSettings.getSettings<RadarSettings>(
      'proximity-radar'
    ).hideDelay;
  }

  get isVisible(): boolean {
    return this.root.appSettings.dragMode ? true : this.visible;
  }

  getNearbyCars(
    _widgetId: 'proximity-radar' | 'radar-bar',
    searchRadius: number
  ): NearbyCar[] {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return [];
    }

    return proximity.nearbyCars.filter((car) => car.clearance <= searchRadius);
  }

  reset() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.visible = false;
  }
}

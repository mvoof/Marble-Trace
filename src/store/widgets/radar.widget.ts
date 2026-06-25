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

  get isLoneQualifying(): boolean {
    const sessionInfo = this.root.session.sessionInfo;

    if (!sessionInfo) {
      return false;
    }

    const currentSession = sessionInfo.sessions[sessionInfo.currentSessionNum];

    if (!currentSession) {
      return false;
    }

    return currentSession.sessionTypeLabel === 'Lone Qualify';
  }

  isHiddenInQualifyingFor(widgetId: 'proximity-radar' | 'radar-bar'): boolean {
    const settings =
      this.root.widgetSettings.getSettings<RadarSettings>(widgetId);
    const visibility = settings.qualifyingVisibility;

    if (visibility === 'never') {
      const sessionInfo = this.root.session.sessionInfo;
      const currentSession =
        sessionInfo?.sessions[sessionInfo.currentSessionNum];
      const isQualifying =
        currentSession?.sessionTypeLabel.toLowerCase().includes('qualify') ??
        false;

      return isQualifying;
    }

    if (visibility === 'auto') {
      return this.isLoneQualifying;
    }

    return false;
  }

  isVisibleForWidget(widgetId: 'proximity-radar' | 'radar-bar'): boolean {
    if (this.root.appSettings.dragMode) {
      return true;
    }

    if (this.isHiddenInQualifyingFor(widgetId)) {
      return false;
    }

    return this.visible;
  }

  get isVisible(): boolean {
    return this.isVisibleForWidget('proximity-radar');
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

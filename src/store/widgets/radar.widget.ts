import { action, makeAutoObservable, reaction } from 'mobx';

import type { RadarSettings } from '@/types/widget-settings';
import { isHiddenInQualifying } from '@utils/qualifying-visibility';
import type { RootStore } from '@store/root-store';

export const RADAR_WIDGET_TYPES = ['proximity-radar', 'radar-bar'] as const;

export type RadarWidgetType = (typeof RADAR_WIDGET_TYPES)[number];

const noneVisible = (): Record<RadarWidgetType, boolean> => ({
  'proximity-radar': false,
  'radar-bar': false,
});

export class RadarWidgetStore {
  // Per widget, not per app: the scope and the bar carry their own activation
  // range and their own fade-out delay, and a driver who widens one does not
  // mean the other. Per *copy* is deliberately not offered — a store is one per
  // app, and the settings panel edits the copy it is opened on.
  visible: Record<RadarWidgetType, boolean> = noneVisible();

  private hideTimers: Record<
    RadarWidgetType,
    ReturnType<typeof setTimeout> | null
  > = { 'proximity-radar': null, 'radar-bar': null };

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this);
  }

  init() {
    for (const widgetType of RADAR_WIDGET_TYPES) {
      this.watch(widgetType);
    }
  }

  private watch(widgetType: RadarWidgetType) {
    reaction(
      () => ({
        hasNearby: this.hasNearbyFor(widgetType),
        hideDelay: this.hideDelayFor(widgetType),
      }),
      ({ hasNearby, hideDelay }) => {
        const pendingHide = this.hideTimers[widgetType];

        if (hasNearby) {
          if (pendingHide) {
            clearTimeout(pendingHide);
            this.hideTimers[widgetType] = null;
          }

          action(() => {
            this.visible[widgetType] = true;
          })();
        } else {
          if (pendingHide) {
            return;
          }

          this.hideTimers[widgetType] = setTimeout(
            action(() => {
              this.visible[widgetType] = false;
              this.hideTimers[widgetType] = null;
            }),
            hideDelay * 1000
          );
        }
      }
    );
  }

  hasNearbyFor(widgetType: RadarWidgetType): boolean {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return false;
    }

    const hasSpotterContact = proximity.spotterLeft || proximity.spotterRight;

    if (hasSpotterContact) {
      return true;
    }

    const { proximityThreshold } = this.settingsOf(widgetType);

    // The threshold is the number the driver reads in the settings, so it is
    // measured the way a driver means it: bumper to bumper, not centre to
    // centre — those differ by a whole car length.
    return proximity.nearbyCars.some(
      (car) => Math.abs(car.bumperDist) <= proximityThreshold
    );
  }

  private hideDelayFor(widgetType: RadarWidgetType): number {
    return this.settingsOf(widgetType).hideDelay;
  }

  private settingsOf(widgetType: RadarWidgetType) {
    return this.root.widgetSettings.getSettings<RadarSettings>(widgetType);
  }

  get isLoneQualifying(): boolean {
    return this.root.session.isLoneQualifying;
  }

  isHiddenInQualifyingFor(widgetType: RadarWidgetType): boolean {
    const settings = this.settingsOf(widgetType);

    return isHiddenInQualifying(
      settings.qualifyingVisibility,
      this.root.session
    );
  }

  isVisibleForWidget(widgetType: RadarWidgetType): boolean {
    if (this.root.appSettings.dragMode) {
      return true;
    }

    if (this.isHiddenInQualifyingFor(widgetType)) {
      return false;
    }

    return this.visible[widgetType];
  }

  reset() {
    for (const widgetType of RADAR_WIDGET_TYPES) {
      const pendingHide = this.hideTimers[widgetType];

      if (pendingHide) {
        clearTimeout(pendingHide);
        this.hideTimers[widgetType] = null;
      }
    }

    this.visible = noneVisible();
  }
}

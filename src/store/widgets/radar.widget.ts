import { action, makeAutoObservable, reaction } from 'mobx';
import type { IReactionDisposer } from 'mobx';

import type {
  ProximityRadarSettings,
  RadarSettings,
} from '@/types/widget-settings';
import {
  DESIGN_SIZE_PX,
  resolveScopeScale,
  scopeDistanceOf,
} from '@utils/radar-constants';
import { isHiddenInQualifying } from '@utils/qualifying-visibility';
import type { RootStore } from '@store/root-store';

type RadarDeps = Pick<
  RootStore,
  'backendComputed' | 'liveWidgets' | 'session' | 'appSettings'
>;

export const RADAR_WIDGET_TYPES = ['proximity-radar', 'radar-bar'] as const;

export type RadarWidgetType = (typeof RADAR_WIDGET_TYPES)[number];

const noneVisible = (): Record<RadarWidgetType, boolean> => ({
  'proximity-radar': false,
  'radar-bar': false,
});

export class RadarWidgetStore {
  // Two widgets, two different questions. The bar is the spotter's own report
  // drawn as a light, so it is on exactly while the spotter is calling a car
  // alongside. The scope is an instrument, and what it activates on is the
  // range it draws: a car inside the circle. Neither has an activation radius
  // of its own to set any more.
  //
  // Per *copy* is deliberately not offered — a store is one per app, and the
  // settings panel edits the copy it is opened on.
  visible: Record<RadarWidgetType, boolean> = noneVisible();

  /** The scope alone fades out; the bar follows the spotter with no delay. */
  private scopeHideTimer: ReturnType<typeof setTimeout> | null = null;

  private disposers: IReactionDisposer[] = [];

  constructor(private readonly root: RadarDeps) {
    makeAutoObservable(this);
  }

  init() {
    this.watchBar();
    this.watchScope();
  }

  private watchBar() {
    this.disposers.push(
      reaction(
        () => this.hasSpotterContact,
        action((hasContact: boolean) => {
          // No timer and no delay: the bar draws the spotter's own call, and it
          // goes the moment the car is past.
          this.visible['radar-bar'] = hasContact;
        })
      )
    );
  }

  private watchScope() {
    this.disposers.push(
      reaction(
        () => ({
          hasNearby: this.hasCarInScope,
          hideDelay: this.scopeHideDelay,
        }),
        ({ hasNearby, hideDelay }) => {
          const pendingHide = this.scopeHideTimer;

          if (hasNearby) {
            if (pendingHide) {
              clearTimeout(pendingHide);
              this.scopeHideTimer = null;
            }

            action(() => {
              this.visible['proximity-radar'] = true;
            })();
          } else {
            if (pendingHide) {
              return;
            }

            this.scopeHideTimer = setTimeout(
              action(() => {
                this.visible['proximity-radar'] = false;
                this.scopeHideTimer = null;
              }),
              hideDelay * 1000
            );
          }
        }
      )
    );
  }

  get hasSpotterContact(): boolean {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return false;
    }

    return proximity.spotterLeft || proximity.spotterRight;
  }

  /** A car inside the circle the scope draws — what the scope activates on. */
  get hasCarInScope(): boolean {
    const proximity = this.root.backendComputed.proximity;

    if (!proximity) {
      return false;
    }

    if (this.hasSpotterContact) {
      return true;
    }

    const rangeMeters = this.scopeRangeMeters;

    return proximity.nearbyCars.some(
      (car) => scopeDistanceOf(car) <= rangeMeters
    );
  }

  /**
   * What the scope covers right now, resolved from the same settings the canvas
   * resolves it from — so the widget never wakes for a car it would have to
   * leave off the picture, and never stays dark with one drawn inside the rim.
   */
  private get scopeRangeMeters(): number {
    const settings = this.settingsOf<ProximityRadarSettings>('proximity-radar');

    const size = Math.min(settings.currentWidth, settings.currentHeight);
    const radiusPx = size / 2;

    return resolveScopeScale({
      scaleMode: settings.scaleMode,
      scopeRange: settings.scopeRange,
      radiusPx,
      widgetScale: size / DESIGN_SIZE_PX,
    }).rangeMeters;
  }

  private get scopeHideDelay(): number {
    return this.settingsOf<ProximityRadarSettings>('proximity-radar').hideDelay;
  }

  private settingsOf<Settings extends RadarSettings = RadarSettings>(
    widgetType: RadarWidgetType
  ) {
    return this.root.liveWidgets.getSettings<Settings>(widgetType);
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
    if (this.scopeHideTimer) {
      clearTimeout(this.scopeHideTimer);
      this.scopeHideTimer = null;
    }

    this.visible = noneVisible();
  }

  dispose() {
    this.reset();

    for (const disposeReaction of this.disposers) {
      disposeReaction();
    }

    this.disposers = [];
  }
}

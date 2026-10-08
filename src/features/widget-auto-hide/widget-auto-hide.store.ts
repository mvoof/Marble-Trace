import { makeAutoObservable } from 'mobx';

import type {
  DrsWidgetSettings,
  FlagDisplaySettings,
  PitLineWidgetSettings,
  PitServiceWidgetSettings,
} from '@shared/contracts/widget-settings';
import type {
  WidgetInstanceStore,
  WidgetInstanceRegistry,
} from '@entities/widget/widget-instances.store';
import { widgetTypeFromId } from '@entities/widget/widget-instance';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';
import type { RadarWidgetStore } from '@entities/radar/radar.store';
import type { FlagsStore } from '@entities/flags/flags.store';
import type { PlayerStore } from '@entities/player/player.store';

/** What the pit service tells auto-hide; the pit service is a sibling feature. */
interface PitServiceVisibility {
  readonly isOnPitRoad: boolean;
  isApproachingWithin: (distanceM: number) => boolean;
  readonly panel: { readonly isVisible: boolean; readonly lingering: boolean };
}

interface WidgetAutoHideDeps {
  liveWidgets: LiveWidgetsView;
  radar: RadarWidgetStore;
  flags: FlagsStore;
  pitServiceWidget: PitServiceVisibility;
  player: PlayerStore;
  widgetInstances: WidgetInstanceRegistry;
}

const NO_LED_FLAG = 'none';

/**
 * A per-instance widget store that decides whether its own instance is on
 * screen. Declared here, not taken from the store: the store lives with its
 * widget under `@ui/**`, which this layer may not import.
 */
export interface SelfHidingWidgetStore extends WidgetInstanceStore {
  readonly isVisible: boolean;
}

/**
 * Whether a widget that hides itself wants to be on screen right now.
 *
 * This is derived, never reported. `WidgetContainer` unmounts the body of a
 * hidden widget, so a widget that pushed its own visibility up from inside that
 * body would latch off the first time it went quiet: the only code that could
 * ever ask for it back went away with the subtree. Every answer here is read
 * from a store instead, all of which keep running whether anything is mounted
 * or not — a per-instance store included, since it lives outside the frame
 * that hides its widget (`WidgetInstanceScope`).
 *
 * A widget absent from the switch is always visible — self-hiding is opt-in.
 */
export class WidgetAutoHideStore {
  constructor(private readonly root: WidgetAutoHideDeps) {
    makeAutoObservable<WidgetAutoHideStore, 'root'>(this, { root: false });
  }

  /** `widgetId` is a copy's id: settings are read per copy, state per widget. */
  isVisible = (widgetId: string): boolean => {
    const widget = this.root.liveWidgets.getWidget(widgetId);
    const widgetType = widget ? widget.type : widgetTypeFromId(widgetId);

    if (widgetType === 'proximity-radar' || widgetType === 'radar-bar') {
      return this.root.radar.isVisibleForWidget(widgetType);
    }

    if (widgetType === 'flat-flags') {
      return (
        this.settingsOf<FlagDisplaySettings>(widgetId).alwaysShow ||
        this.root.flags.displayFlags.length > 0
      );
    }

    if (widgetType === 'led-flags') {
      return (
        this.settingsOf<FlagDisplaySettings>(widgetId).alwaysShow ||
        this.root.flags.ledDisplayFlag !== NO_LED_FLAG
      );
    }

    // A car without DRS never publishes the field at all, so the answer is the
    // car rather than a state it is in. It is answered here rather than by the
    // widget returning nothing, because the container keeps drawing its plate
    // around a body that renders null — an empty box on every GT3 is exactly
    // what this setting is asked for.
    if (widgetType === 'drs') {
      const settings = this.settingsOf<DrsWidgetSettings>(widgetId);
      const drs = this.root.player.carStatus?.drs ?? null;

      if (drs === null) {
        return settings.hideWhenCarHasNoDrs === false;
      }

      return drs !== 'Unavailable' || !settings.hideWhenUnavailable;
    }

    // Nobody inside the gap threshold means nothing to show, and the plate the
    // container draws around an empty body would say otherwise. Each plate has
    // its own threshold, so the answer is its own instance's store — which
    // exists for as long as the instance is mounted, hidden or not.
    if (widgetType === 'wheel-to-wheel') {
      return (
        this.root.widgetInstances.storeOf<SelfHidingWidgetStore>(widgetId)
          ?.isVisible ?? false
      );
    }

    if (widgetType === 'pit-service') {
      return (
        this.settingsOf<PitServiceWidgetSettings>(widgetId).alwaysVisible ||
        this.root.pitServiceWidget.panel.isVisible
      );
    }

    // The lane bars come and go with the same stop the order does, but not on
    // the same approach: the box is opened a lap out to be edited, the bars are
    // wanted at the entry itself, so they carry their own reveal distance and
    // ride the panel only for the tail after pit exit.
    if (widgetType === 'pit-line') {
      const settings = this.settingsOf<PitLineWidgetSettings>(widgetId);
      const pitService = this.root.pitServiceWidget;

      return (
        settings.alwaysVisible ||
        pitService.isOnPitRoad ||
        pitService.isApproachingWithin(settings.revealOnApproachM) ||
        pitService.panel.lingering
      );
    }

    return true;
  };

  private settingsOf = <
    SpecificSettings extends
      | DrsWidgetSettings
      | FlagDisplaySettings
      | PitServiceWidgetSettings
      | PitLineWidgetSettings,
  >(
    widgetId: string
  ) => this.root.liveWidgets.getSettings<SpecificSettings>(widgetId);
}

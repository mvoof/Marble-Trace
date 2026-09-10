import { makeAutoObservable } from 'mobx';

import type {
  FlagDisplaySettings,
  PitLineWidgetSettings,
  PitServiceWidgetSettings,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import { widgetTypeFromId, widgetTypeOf } from '@utils/widget-instance';

type WidgetAutoHideDeps = Pick<
  RootStore,
  'liveWidgets' | 'radar' | 'flags' | 'pitServiceWidget'
>;

const NO_LED_FLAG = 'none';

/**
 * Whether a widget that hides itself wants to be on screen right now.
 *
 * This is derived, never reported. `WidgetContainer` unmounts the body of a
 * hidden widget, so a widget that pushed its own visibility up from inside that
 * body would latch off the first time it went quiet: the only code that could
 * ever ask for it back went away with the subtree. Every answer here is read
 * from a store instead, all of which keep running whether anything is mounted
 * or not.
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
    const widgetType = widget
      ? widgetTypeOf(widget)
      : widgetTypeFromId(widgetId);

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
      | FlagDisplaySettings
      | PitServiceWidgetSettings
      | PitLineWidgetSettings,
  >(
    widgetId: string
  ) => this.root.liveWidgets.getSettings<SpecificSettings>(widgetId);
}

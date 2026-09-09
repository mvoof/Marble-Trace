import { makeAutoObservable } from 'mobx';

import type {
  FlagDisplaySettings,
  PitServiceWidgetSettings,
} from '@/types/widget-settings';
import type { RootStore } from '@store/root-store';
import { widgetTypeFromId, widgetTypeOf } from '@utils/widget-instance';

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
  constructor(private readonly root: RootStore) {
    makeAutoObservable<WidgetAutoHideStore, 'root'>(this, { root: false });
  }

  /** `widgetId` is a copy's id: settings are read per copy, state per widget. */
  isVisible = (widgetId: string): boolean => {
    const widget = this.root.widgetSettings.getWidget(widgetId);
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

    return true;
  };

  private settingsOf = <
    SpecificSettings extends FlagDisplaySettings | PitServiceWidgetSettings,
  >(
    widgetId: string
  ) => this.root.widgetSettings.getSettings<SpecificSettings>(widgetId);
}

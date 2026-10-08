import {
  bool,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const DRS_SETTINGS = defineSettings('drs', {
  /**
   * Draw nothing at all while DRS is unavailable, rather than a quiet plate.
   * Off by default: a widget that vanishes and comes back is harder to find
   * again than one that sits still and goes dim.
   */
  hideWhenUnavailable: bool(false),
  /**
   * Take the widget off the screen entirely on a car that has no DRS at all.
   *
   * On by default, and a different question from `hideWhenUnavailable`: that
   * one is about a state the car passes through lap after lap, this one about
   * a car that will never have the system. Off, the plate stays where the
   * driver put it and says so, which is what somebody building a fixed layout
   * across several cars wants.
   */
  hideWhenCarHasNoDrs: bool(true),
});

export type DrsWidgetSettings = SettingsOf<typeof DRS_SETTINGS.shape>;

import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const HORIZONTAL_ROWS = ['auto', 1, 2, 3] as const;
export type HorizontalRows = (typeof HORIZONTAL_ROWS)[number];

export const ENGINE_PANEL_SETTINGS = defineSettings('enginePanel', {
  showOilTemp: bool(true),
  showWaterTemp: bool(true),
  showOilPress: bool(true),
  showVoltage: bool(true),
  showAbs: bool(true),
  showTc: bool(true),
  /** Second traction control channel, on the cars that carry one. */
  showTc2: bool(true),
  showBrakeBias: bool(true),
  /** Fine brake bias trim, in points on top of the coarse value. */
  showBrakeBiasFine: bool(true),
  showPeakBrakeBias: bool(true),
  showEngineMap: bool(true),
  showEngineBraking: bool(true),
  showDiffEntry: bool(true),
  showDiffMiddle: bool(true),
  /** Corner exit on some cars, high speed on others — one field either way. */
  showDiffExit: bool(true),
  /** Front anti-roll bar, on the cars that adjust it from the wheel. */
  showAntiRollFront: bool(true),
  /** Rear anti-roll bar, on the cars that adjust it from the wheel. */
  showAntiRollRear: bool(true),
  /**
   * The car's spare brake rotary — brake bias migration on the hybrid
   * prototypes, something else elsewhere. The slot has no fixed meaning.
   */
  showBrakeMisc: bool(true),
  /**
   * Flash a cell's background when the driver moves that adjustment. The brake
   * cells flash green and the differential cells blue, so the colour says which
   * system moved before the label is read.
   */
  highlightChanges: bool(true),
  /**
   * Systems side by side in rows; off, one tier per system, stacked.
   */
  horizontal: bool(true),
  /**
   * How many rows the horizontal layout splits the systems into. `auto` keeps
   * one row while it fits and balances the systems across two otherwise.
   */
  horizontalRows: choice(HORIZONTAL_ROWS, 'auto'),
});

export type EnginePanelWidgetSettings = SettingsOf<
  typeof ENGINE_PANEL_SETTINGS.shape
>;

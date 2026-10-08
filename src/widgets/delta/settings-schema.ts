import { LAP_DELTA_REFERENCE } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const DELTA_SETTINGS = defineSettings('delta', {
  reference: choice(LAP_DELTA_REFERENCE, 'personal_best'),
  showLapFlash: bool(false),
  /** Seconds the lap-completed card stays up. */
  flashDuration: num(5, { min: 3, max: 10 }),
  hideWhenNoReference: bool(false),
  /** Horizontal ±1 s bar under the number, filled from the centre. */
  showGauge: bool(true),
});

export type DeltaWidgetSettings = SettingsOf<typeof DELTA_SETTINGS.shape>;

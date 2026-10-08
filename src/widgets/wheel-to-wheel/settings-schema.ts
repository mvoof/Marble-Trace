import { QUALIFYING_VISIBILITY } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/**
 * `columns`: you on the left, the gap in the middle, the rival on the right.
 * `rows`: one row per driver, stacked in track order — ahead, you, behind.
 */
export const WHEEL_TO_WHEEL_LAYOUT = ['columns', 'rows'] as const;
export type WheelToWheelLayout = (typeof WHEEL_TO_WHEEL_LAYOUT)[number];

export const WHEEL_TO_WHEEL_SETTINGS = defineSettings('wheelToWheel', {
  layout: choice(WHEEL_TO_WHEEL_LAYOUT, 'columns'),
  /**
   * Seconds. The nearest car of your class on your lap inside this is the
   * fight; it leaves the plate at 1.3 × this value. Below a quarter nobody is
   * ever inside; past three it is not a fight.
   */
  gapThreshold: num(1, { min: 0.25, max: 3, step: 0.25 }),
  /** Seconds the plate stays after the rival left the threshold. */
  hideDelay: num(3, { min: 0, max: 15, step: 0.5 }),
  /**
   * Off: a car passing you in practice is a fight worth seeing too, and the
   * gap threshold already keeps random traffic off the plate.
   */
  raceOnly: bool(false),
  /**
   * In a race, cars a lap ahead or behind count as rivals too. Off by default:
   * lapping traffic is not a fight. Outside a race it changes nothing — lap
   * counts there only say when each car joined.
   */
  includeLapped: bool(false),
  /** Alone on track there is nobody to fight. */
  qualifyingVisibility: choice(QUALIFYING_VISIBILITY, 'auto', {
    label: 'common.qualifyingVisibility',
  }),
});

export type WheelToWheelWidgetSettings = SettingsOf<
  typeof WHEEL_TO_WHEEL_SETTINGS.shape
>;

import { FLAG_ZONE_STYLE } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const LINEAR_MAP_ORIENTATION = ['horizontal', 'vertical'] as const;
export type LinearMapOrientation = (typeof LINEAR_MAP_ORIENTATION)[number];

const MARKER_RADIUS_PX = { min: 1, max: 30 };

export const LINEAR_MAP_SETTINGS = defineSettings('linearMap', {
  orientation: choice(LINEAR_MAP_ORIENTATION, 'horizontal'),
  playerDotColor: color('#18181b'),
  targetDotRadiusPx: num(10, MARKER_RADIUS_PX),
  /** The safety-car marker takes the pace car's class color. */
  paceCarUseClassColor: bool(false, { label: 'common.paceCarUseClassColor' }),
  /** The safety-car marker's own color, while it does not take the class color. */
  paceCarColor: color('#facc15', { label: 'common.paceCarColor' }),
  /** Safety-car marker radius in px, apart from the competitor dots. */
  paceCarRadiusPx: num(10, MARKER_RADIUS_PX, {
    label: 'common.paceCarRadiusPx',
  }),
  /** Keeps the safety-car marker on the strip while it is parked in its pit stall. */
  paceCarShowInPits: bool(false, { label: 'common.paceCarShowInPits' }),
  /** Gives every car class its own marker shape instead of a circle for all. */
  classShapes: bool(false, { label: 'common.classShapes' }),
  /**
   * Paints a warning stretch of the lap around every car the backend found
   * stopped on track or off it. iRacing gives no position for a yellow or a
   * debris flag, so the incident itself is what gets located — see
   * `computations/incidents.rs`.
   */
  showIncidentZones: bool(true),
  /** Blinks an active incident zone instead of holding it steady. */
  blinkIncidentZones: bool(true),
  flagZoneStyle: choice(FLAG_ZONE_STYLE, 'filled'),
});

export type LinearMapWidgetSettings = SettingsOf<
  typeof LINEAR_MAP_SETTINGS.shape
>;

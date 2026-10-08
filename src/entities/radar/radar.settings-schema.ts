import { QUALIFYING_VISIBILITY } from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

/**
 * The settings of both radars, described here beside the store they share
 * rather than in either widget's slice: the store reads them, and one radar
 * deleted must not take the other's description with it.
 */

/**
 * What the widget's own size does to the picture. The scope covers
 * `radius / pxPerMeter` meters, so fixing any two of the three fixes the third
 * — this is which two the user pins. `fixed-scope`: the scope is a constant of
 * the design and the widget's size zooms it all. `fixed-cars`: the
 * metres-to-pixels ratio is constant and a bigger widget sees further.
 * `manual`: the scope is typed in by hand and the cars follow it.
 */
export const RADAR_SCALE_MODE = [
  'fixed-scope',
  'fixed-cars',
  'manual',
] as const;
export type RadarScaleMode = (typeof RADAR_SCALE_MODE)[number];

export const RADAR_BACKGROUND_TEXTURE = [
  'none',
  'polar-dots',
  'polar-mesh',
  'hatch',
  'scanlines',
] as const;
export type RadarBackgroundTexture = (typeof RADAR_BACKGROUND_TEXTURE)[number];

const OPACITY = { min: 0.1, max: 1, step: 0.05 };

/**
 * What both radars share. Neither carries an activation radius: the bar is on
 * while the spotter calls a car alongside, and the scope while a car is inside
 * the range it draws.
 */
const RADAR_SHAPE = {
  qualifyingVisibility: choice(QUALIFYING_VISIBILITY, 'auto', {
    label: 'common.qualifyingVisibility',
  }),
  showDistance: bool(true),
};

export const RADAR_BAR_SETTINGS = defineSettings('radar', RADAR_SHAPE);

/** The round scope adds what only it can draw. */
export const PROXIMITY_RADAR_SETTINGS = defineSettings('radar', {
  ...RADAR_SHAPE,
  /**
   * Seconds the scope stays up after the last car left the circle. The bar has
   * no such delay: it goes with the spotter's call.
   */
  hideDelay: num(2, { min: 0, max: 30, step: 0.5 }),
  scaleMode: choice(RADAR_SCALE_MODE, 'fixed-scope'),
  /** Radius in meters the circle covers. Read only when `scaleMode` is manual. */
  scopeRange: num(10, { min: 5, max: 30, step: 1 }),
  backgroundTexture: choice(RADAR_BACKGROUND_TEXTURE, 'polar-dots'),
  showAxes: bool(true),
  /** Distance ticks along the vertical axis, drawn only with the axes. */
  showAxisTicks: bool(true),
  showRangeRings: bool(true),
  /** The beam that follows an opponent for as long as it is in the scope. */
  showBeam: bool(true),
  /** White bodies; off paints each car in its own threat color. */
  monochromeCars: bool(true),
  /** Alpha every car body is drawn at, the player's own included. */
  carOpacity: num(1, OPACITY),
  /**
   * Alpha of the tracking beam at its densest stop. The setting is the beam's
   * alpha outright, and a solid sector would bury the scope behind it — the
   * shipped beam is a wash, not a fill.
   */
  beamOpacity: num(0.35, OPACITY),
  /** Arc markers parking a car that is past the rim at its bearing. */
  showEdgeMarkers: bool(true),
});

export type RadarSettings = SettingsOf<typeof RADAR_BAR_SETTINGS.shape>;
export type ProximityRadarSettings = SettingsOf<
  typeof PROXIMITY_RADAR_SETTINGS.shape
>;

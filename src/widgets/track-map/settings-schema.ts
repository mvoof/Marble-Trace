import {
  FLAG_ZONE_STYLE,
  QUALIFYING_VISIBILITY,
} from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  color,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const TRACK_MAP_LEADER_LABEL_MODE = [
  'all',
  'own-class',
  'none',
] as const;
export type TrackMapLeaderLabelMode =
  (typeof TRACK_MAP_LEADER_LABEL_MODE)[number];

const MARKER_RADIUS_PX = { min: 1, max: 30 };

export const TRACK_MAP_SETTINGS = defineSettings('trackMap', {
  showSectors: bool(true),
  showSectorsOnMap: bool(true),
  rotationMode: choice(['fixed', 'heading-up'], 'fixed'),
  playerDotColor: color('#18181b'),
  showPlayerLabel: bool(true),
  leaderLabelMode: choice(TRACK_MAP_LEADER_LABEL_MODE, 'all'),
  /**
   * Picks which order the leader label follows: the live on-track one, or the
   * sim's official positions, which only refresh at the start/finish line.
   */
  useLivePositions: bool(true),
  trackStrokePx: num(10, { min: 1, max: 30 }),
  trackBorderPx: num(3, { min: 0, max: 20 }),
  sectorStrokePx: num(6, { min: 1, max: 20 }),
  targetDotRadiusPx: num(10, MARKER_RADIUS_PX),
  showStartFinish: bool(true),
  /** The safety-car marker takes the pace car's class color. */
  paceCarUseClassColor: bool(false, { label: 'common.paceCarUseClassColor' }),
  /** The safety-car marker's own color, while it does not take the class color. */
  paceCarColor: color('#facc15', { label: 'common.paceCarColor' }),
  /** Safety-car marker radius in px, apart from the competitor dots. */
  paceCarRadiusPx: num(10, MARKER_RADIUS_PX, {
    label: 'common.paceCarRadiusPx',
  }),
  /** Keeps the safety-car marker on the map while it is parked in its pit stall. */
  paceCarShowInPits: bool(false, { label: 'common.paceCarShowInPits' }),
  /** The map shows only a magnified window centered on the player. */
  zoomEnabled: bool(false),
  /** Magnification of the zoomed view (1 = whole track). */
  zoomLevel: num(3, { min: 1.5, max: 10, step: 0.5 }),
  /** Rotates the zoomed view so the player's travel direction points up. */
  zoomRotate: bool(false),
  /**
   * Paints the circular follow window with a solid ground so the cropped map
   * reads against whatever is behind the overlay.
   */
  zoomCircleBackground: bool(false),
  zoomCircleColor: color('#09090b'),
  zoomCircleOpacity: num(0.85, { min: 0.1, max: 1, step: 0.05 }),
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
  /** Whether other drivers stay on the map during a qualifying session. */
  qualifyingVisibility: choice(QUALIFYING_VISIBILITY, 'always'),
});

export type TrackMapWidgetSettings = SettingsOf<
  typeof TRACK_MAP_SETTINGS.shape
>;

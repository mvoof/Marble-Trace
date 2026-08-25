import type React from 'react';
import type { CapabilitiesPayload } from '@/types/bindings';
import type { TelemetryEventName } from '@/types/telemetry-events';

type RpmColorTheme = 'custom' | 'gradient' | 'classic';
export type LedShape = 'square' | 'circle' | 'parallelogram';

export interface RpmLightsWidgetSettings {
  rpmColorTheme: RpmColorTheme;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorShift: string;
  rpmColorLimit: string;
  ledShape: LedShape;
}

export type RpmIndicatorMode = 'fill' | 'comb' | 'glow' | 'off';

/*
 * Every widget that prints a position number carries its own `useLivePositions`
 * flag with these semantics. On: rank by order on track, recomputed from covered
 * distance every tick. Off: the sim's official number, which only refreshes when
 * a car crosses start/finish — outside a race that order is by best lap. The flag
 * is not conditioned on session type; practice, qualifying and race behave alike.
 */

export type InvisibleDashRenderMode = 'projection' | 'contour';
export type InvisibleDashRpmFormat = 'absolute' | 'percent';
export type InvisibleDashBackdropScope = 'clusters' | 'full';

export interface InvisibleDashWidgetSettings {
  showSpeed: boolean;
  showRpm: boolean;
  showGear: boolean;
  showPosition: boolean;
  showLap: boolean;
  showShiftBar: boolean;
  /** 'projection' = bloom in the tint color, 'contour' = hairline stroke, no glow. */
  renderMode: InvisibleDashRenderMode;
  /** Strength of the projection bloom, 0–100. Ignored in contour mode. */
  bloomIntensity: number;
  /** Color the projection glows in — the halo only, not the glyphs. */
  projectionTint: string;
  /** Color of the digits themselves, below the high rev zone. */
  textColor: string;
  /**
   * Wash behind the digits — the clusters only, never the empty middle. Carries
   * its own alpha, so a fully transparent value leaves the digits on bare glass.
   */
  backdropColor: string;
  /**
   * Where the wash is painted: behind each cluster, or behind the whole strip.
   * 'full' keeps the plate in the strip's own tilted plane, so it foreshortens
   * with the digits instead of reading as a flat panel on the glass.
   */
  backdropScope: InvisibleDashBackdropScope;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorShift: string;
  rpmColorLimit: string;
  /** Tint the RPM number with the zone color at high revs. */
  colorizeRpmByZone: boolean;
  /** Tint the gear digit with the zone color at high revs. */
  colorizeGearByZone: boolean;
  /** How far the strip is pushed into the scene, 0–100: tilt, shrink and fade. */
  depth: number;
  /**
   * How hard the readout wraps around the windscreen, 0–100: the two clusters
   * yaw away from the driver and ride up toward the pillars.
   */
  curvature: number;
  rpmFormat: InvisibleDashRpmFormat;
  useLivePositions: boolean;
  classPositionInMulticlass: boolean;
}

export interface RaceDashWidgetSettings {
  pitSpeedLimitOverride: number | null;
  showPitAssist: boolean;
  boxCueDistM: number;
  nearLimitDelta: number;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorShift: string;
  rpmColorLimit: string;
  /** Tint the gear digit and RPM number with the zone color at high revs. */
  colorizeByRpmZone: boolean;
  /** 'fill' = colored RPM arc around the ring, 'comb' = discrete ticks on that same ring, 'glow' = rim glows near shift, 'off' = no RPM indication. */
  rpmIndicatorMode: RpmIndicatorMode;
  /** Source of the P-number in the stats strip and the pit block. */
  useLivePositions: boolean;
  /** Count the P-number within the player's own class instead of the whole field, in multiclass sessions. */
  classPositionInMulticlass: boolean;
  /** Tint the P-number by which band of the field the player is running in. */
  colorizePosition: boolean;
  positionColorP1: string;
  positionColorTop3: string;
  positionColorTop5: string;
  positionColorTop10: string;
  positionColorRest: string;
  /** Steering angle wedge riding the outer rim of the gear ring. */
  showSteeringMarker: boolean;
  /** Color of the trail the steering marker leaves behind it on the rim. */
  steeringTrailColor: string;
}

export type SteeringCenterDisplay =
  | 'logo'
  | 'gear'
  | 'speed'
  | 'angle'
  | 'speed-gear';

export interface InputTraceSettings {
  steeringCenterDisplay: SteeringCenterDisplay;
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
  showSteering: boolean;
  showTrace: boolean;
  throttleColor: string;
  brakeColor: string;
  clutchColor: string;
  absColor: string;
  historySeconds: number;
  lineWidth: number;
  smoothing: number;
  // The physical lock-to-lock range is app-wide (appSettings.steeringLock) —
  // it describes the wheel on the desk, not this widget. Only the display
  // zoom on top of it belongs here.
  steeringZoom?: number;
}

export type RadarQualifyingVisibility = 'always' | 'never' | 'auto';

export interface RadarSettings {
  proximityThreshold: number;
  hideDelay: number;
  qualifyingVisibility: RadarQualifyingVisibility;
  showDistance: boolean;
}

export type BattleTrigger = 'gap' | 'distance';

export type BattleSides = 'both' | 'ahead' | 'behind';

export type BattleOtherClass = 'show' | 'dim' | 'hide';

/** How much of the opponent's name the plate spends its width on. */
export type BattleNameMode = 'surname' | 'initial' | 'full';

export interface CloseBattleWidgetSettings {
  /** What counts as "close": a gap in seconds, or a real distance in meters. */
  trigger: BattleTrigger;
  /** Seconds. Kept apart from the distance threshold so switching the trigger
   * never carries a value into a range where it is invalid. */
  gapThreshold: number;
  /** Meters, the radar's own lower bound: below 5 m you are already touching. */
  distanceThreshold: number;
  /** Seconds a row stays after the opponent left the threshold. */
  hideDelay: number;
  sides: BattleSides;
  maxRows: number;
  showTicks: boolean;
  /** The meters printed on the ticks. Off leaves the marks and drops the digits. */
  showTickLabels: boolean;
  /** Axis only: no plates, no names, no numbers. */
  compactMode: boolean;
  showDistance: boolean;
  /**
   * The whole laps between you and the car, as `1L` beside the gap. Off in a
   * sprint, where nobody is ever a lap apart and the column is pure width.
   */
  showLapGap: boolean;
  /**
   * The make, abbreviated the way Standings abbreviates it — "MER", "POR".
   * Worth its column in a multi-make class and pure noise in a one-make one.
   */
  showBrand: boolean;
  nameMode: BattleNameMode;
  /**
   * Cars that land in the same spot on the axis are drawn as one plate with a
   * `+N` badge instead of shoving each other aside.
   */
  mergeOverlapping: boolean;
  /**
   * How close two cars must be, in meters, to share a plate. A car length or
   * two: at that range they are genuinely side by side, and the axis has
   * nothing left to separate them with.
   */
  mergeDistance: number;
  /** Nothing to fight on pit road, so the widget leaves while you are on it. */
  hideInPits: boolean;
  /**
   * Same rule as the radar and the track map: `auto` blanks the widget in solo
   * qualifying, where the cars it would name are not on track with you.
   */
  qualifyingVisibility: RadarQualifyingVisibility;
  /**
   * Opacity of the plate itself, 0.3–1. Opaque by default: a see-through row
   * loses its own edges against a corner. The only other thing that fades a
   * plate is `otherClass: 'dim'`, and that one means something.
   */
  plateOpacity: number;
  showClassBadge: boolean;
  /** Distant plates shrink, never past a third of their size. */
  scaleByDistance: boolean;
  otherClass: BattleOtherClass;
  /** Meters at which the glow starts to build (0 = no glow). */
  glowRange: number;
  raceOnly: boolean;
}

export type RowPadding = 'narrow' | 'medium' | 'wide';

export type StandingsViewMode = 'all' | 'cycling' | 'grouped';

export interface StandingsWidgetSettings {
  rowPadding: RowPadding;
  viewMode: StandingsViewMode;
  /** Seconds of inactivity after which a manual scroll returns to the automatic view (0 = keep it). */
  scrollResetSeconds: number;
  showPosChange: boolean;
  /** Transient up/down arrow shown in the position cell right after a live position change. */
  showLivePosChange: boolean;
  /**
   * Drives the position number, the row order of the table, the move animation
   * and its arrows, and which of the two projected iR deltas the ΔiR column reads.
   */
  useLivePositions: boolean;
  /** Rows shown in front of the player when they no longer fit in the top block (0 = pin the player row only). */
  driversAhead: number;
  /** Rows shown behind the player when they no longer fit in the top block. */
  driversBehind: number;
  /** Driver rows each class gets in grouped view (0 = split the widget height evenly between classes). */
  groupedRowsPerClass: number;
  showColumnHeaders: boolean;
  showSessionHeader: boolean;
  /** Session time remaining (or elapsed) in the header, same clock as the Timer widget. */
  showSessionTime: boolean;
  showWeather: boolean;
  showSOF: boolean;
  showTotalDrivers: boolean;
  showBrand: boolean;
  showTire: boolean;
  showLicBadge: boolean;
  showIRating: boolean;
  /** Projected iR change column (Elo-based estimate, not real SDK data) */
  showIrChange: boolean;
  /** Player-only pit stop counter (counted on the frontend) */
  showPitStops: boolean;
  showLapsCompleted: boolean;
  showIncidentsBadge: boolean;
  abbreviateNames: boolean;
  showDriverFlags: boolean;
  /**
   * Drop rows for cars the sim marked as retired or disqualified. The player's own
   * row is always kept, and cars merely sitting in the garage are not affected.
   */
  hideRetiredDrivers: boolean;
  /** Highlight color for the player's own row. */
  playerRowColor: string;
  /** Color of the player's position number and car number. */
  playerAccentColor: string;
}

export interface RelativeWidgetSettings {
  /**
   * Source of the position number in the leftmost column. Row order is always by
   * gap on track — that is what the widget is for — so this affects the number only.
   */
  useLivePositions: boolean;
  rowPadding: RowPadding;
  showLicBadge: boolean;
  showIRating: boolean;
  showPitIndicator: boolean;
  abbreviateNames: boolean;
  showDriverFlags: boolean;
  /** Highlight color for the player's own row. */
  playerRowColor: string;
  /** Color of the player's position number and car number. */
  playerAccentColor: string;
  /** When true, keeps showing the safety car row while it's parked in its pit stall. */
  paceCarShowInPits?: boolean;
}

type TrackMapRotationMode = 'fixed' | 'heading-up';
export type TrackMapLeaderLabelMode = 'all' | 'own-class' | 'none';

export interface TrackMapWidgetSettings {
  showSectors: boolean;
  showSectorsOnMap: boolean;
  rotationMode: TrackMapRotationMode;
  playerDotColor: string;
  showPlayerLabel: boolean;
  leaderLabelMode: TrackMapLeaderLabelMode;
  /**
   * Picks which order the leader label follows: the live on-track one, or the
   * sim's official positions, which only refresh at the start/finish line.
   */
  useLivePositions: boolean;
  trackStrokePx: number;
  trackBorderPx: number;
  sectorStrokePx: number;
  targetDotRadiusPx: number;
  showStartFinish?: boolean;
  /** When true the safety-car marker uses the pace car's class color. */
  paceCarUseClassColor?: boolean;
  /** Custom safety-car marker color used when not tracking the class color. */
  paceCarColor?: string;
  /** Safety-car marker radius in px (independent of the competitor dots). */
  paceCarRadiusPx?: number;
  /** When true, keeps showing the safety-car marker while it's parked in its pit stall. */
  paceCarShowInPits?: boolean;
  /** When true the map shows only a magnified window centered on the player. */
  zoomEnabled?: boolean;
  /** Magnification factor of the zoomed view (1 = whole track). */
  zoomLevel?: number;
  /** Rotates the zoomed view so the player's travel direction points up. */
  zoomRotate?: boolean;
  /** Gives every car class its own marker shape instead of a circle for all. */
  classShapes?: boolean;
  /** Whether other drivers stay on the map during a qualifying session. */
  qualifyingVisibility?: RadarQualifyingVisibility;
}

export type LinearMapOrientation = 'horizontal' | 'vertical';

export interface LinearMapWidgetSettings {
  orientation: LinearMapOrientation;
  playerDotColor: string;
  targetDotRadiusPx: number;
  /** When true the safety-car marker uses the pace car's class color. */
  paceCarUseClassColor?: boolean;
  /** Custom safety-car marker color used when not tracking the class color. */
  paceCarColor?: string;
  /** Safety-car marker radius in px (independent of the competitor dots). */
  paceCarRadiusPx?: number;
  /** When true, keeps showing the safety-car marker while it's parked in its pit stall. */
  paceCarShowInPits?: boolean;
  /** Gives every car class its own marker shape instead of a circle for all. */
  classShapes?: boolean;
}

export interface WeatherWidgetSettings {
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showForecast: boolean;
  showTrackWetness: boolean;
  showWindBearing: boolean;
}

export interface FuelWidgetSettings {
  showChart: boolean;
  pitWarningLaps: number;
  /** Laps averaged for consumption; 0 = every lap of the session. */
  fuelAvgWindow: number;
  showNextStopForecast: boolean;
  chartType: 'line' | 'bar';
  barWidth: number;
  showStatLast: boolean;
  showStatAvg10: boolean;
  showStatMin: boolean;
  showStatMax: boolean;
}

export type LapDeltaReference =
  | 'personal_best'
  | 'personal_optimal'
  | 'session_best'
  | 'session_optimal'
  | 'session_last';
export interface DeltaWidgetSettings {
  reference: LapDeltaReference;
  showLapFlash: boolean;
  flashDuration: number;
  hideWhenNoReference: boolean;
  /** Horizontal ±1 s bar under the number, filled from the centre. */
  showGauge: boolean;
}

export interface SectorMatrixWidgetSettings {
  showPredicted: boolean;
  showSectors: boolean;
}

/**
 * Presentation only. The channel to read and the sign-in state live in
 * appSettings instead: a chat source is a property of the account, not of a
 * layout, and re-entering the channel per layout would be absurd.
 */
export interface StreamChatWidgetSettings {
  /** Nick and text share one wrapped line, the way Twitch itself renders it. */
  compactRows: boolean;
  /**
   * Scrollback depth, not the number of rows on screen — how many messages fit
   * is measured from the rendered list, since a message is as tall as its text.
   */
  maxMessages: number;
  /** Seconds before a message fades out. 0 keeps everything. */
  messageLifetimeSeconds: number;
  showPlatformGlyph: boolean;
  showBadges: boolean;
  /**
   * Draw the platform's own badge artwork instead of text plates. Twitch
   * artwork resolves only while signed in (the anonymous badge host was
   * retired), so this silently falls back to plates otherwise.
   */
  badgeImages: boolean;
  /** Header line with the connection state and the room restriction. */
  showBanner: boolean;
  showFooter: boolean;
  showActivity: boolean;
  /** Subscriptions, raids and Super Chat rows. */
  showEvents: boolean;
  /**
   * The "waiting for messages" line while the feed is idle. Off leaves the
   * widget blank until something arrives, which is what an overlay that sits
   * on camera the whole session wants.
   */
  showPlaceholder: boolean;
}

export interface TimerWidgetSettings {
  showSessionType: boolean;
  showLaps: boolean;
  showPosition: boolean;
  /** Source of the position shown in the footer. */
  useLivePositions: boolean;
  /** Count the footer position within the player's own class instead of the whole field, in multiclass sessions. */
  classPositionInMulticlass: boolean;
  showWallClock: boolean;
  showSimTime: boolean;
  showPcDate: boolean;
  showSimDate: boolean;
}

export interface FlagDisplaySettings {
  alwaysShow: boolean;
  holdDuration: number;
  split?: boolean;
  animate?: boolean;
  forceSingleLed?: boolean;
  modeWidths?: Record<string, number>;
}

export type PitApproachPlacement = 'inline' | 'side';

export type PitApproachSide = 'left' | 'right';

export interface PitServiceWidgetSettings {
  showPitSpeed: boolean;
  /**
   * The approach rail: distance to the stall over a picture of the pit lane,
   * with the braking cue. Read together with the speed plate it answers the
   * whole of "how fast, how far" from one place.
   */
  showPitApproach: boolean;
  /**
   * `inline` puts the rail in the widget stack as a horizontal block; `side`
   * hangs it as a vertical rail against the panel edge, where it stays readable
   * with the eyes on the road.
   */
  pitApproachPlacement: PitApproachPlacement;
  /** Which edge the `side` rail sits on. */
  pitApproachSide: PitApproachSide;
  /** Distance to the stall, in meters, at which the countdown starts warning. */
  pitApproachCueDistM: number;
  /**
   * Meters before the pit entry line at which the widget shows itself, so the
   * order can still be changed on the way in. Zero switches it off and the box
   * appears on pit road as before.
   */
  revealOnApproachM: number;
  /** Mark where braking has to start to stop in the stall. */
  showPitBrakeCue: boolean;
  /** Source of the P-number in the footer. */
  useLivePositions: boolean;
  /** Count the P-number within the player own class in multiclass sessions. */
  classPositionInMulticlass: boolean;
  /** Estimate the position the car rejoins in, based on the repair and tow waits. */
  showProjectedPosition: boolean;
  showFuel: boolean;
  showTires: boolean;
  showRepairs: boolean;
  showFooter: boolean;
  alwaysVisible: boolean;
  /**
   * Auto mode checks the calculated fuel amount on pit entry. Auto mode as a
   * whole is on whenever this or `autoTires` is — there is no separate master
   * switch, an auto mode that orders nothing would just be off with extra steps.
   */
  autoFuel: boolean;
  /** Auto mode checks the corners worn past `autoTireWearThreshold`. */
  autoTires: boolean;
  /**
   * Remaining tread, in percent, at or below which auto mode orders a corner.
   * Measured on the most worn of the three points across the tread.
   */
  autoTireWearThreshold: number;
  /**
   * How much one press of the fuel up / down keys moves the order, in the unit
   * the driver reads — liters on metric, gallons on imperial. A step is a whole
   * unit either way, so the number on the bar moves by what the setting says.
   */
  fuelAdjustStep: FuelAdjustStep;
  /**
   * Seconds the widget shows itself after a command — a tire picked, the fuel
   * stepped, auto mode handed over — so a key pressed on track can be read back
   * without the panel staying up for the rest of the lap. Zero switches it off.
   *
   * The temporary-show key is not one of these: it is a latch the driver closes
   * themselves, and putting it on a timer would take the box away mid-edit.
   */
  commandRevealSeconds: number;
}

/**
 * Fixed rather than free: the keys are pressed with a wheel-mounted button on
 * the way into the pits, and the useful steps are "a splash", "a stint" and the
 * couple in between, not an arbitrary figure typed in the settings.
 */
export const FUEL_ADJUST_STEPS = [1, 5, 10, 15, 20] as const;

export type FuelAdjustStep = (typeof FUEL_ADJUST_STEPS)[number];

export type GMeterDisplayMode = 'trail' | 'fading' | 'peak';
export type GMeterColorMode = 'mono' | 'simple' | 'advanced';

export interface GMeterWidgetSettings {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
}

export interface EnginePanelWidgetSettings {
  showOilTemp: boolean;
  showWaterTemp: boolean;
  showOilPress: boolean;
  showVoltage: boolean;
  showAbs: boolean;
  showTc: boolean;
  showBrakeBias: boolean;
  showEngineMap: boolean;
  horizontal: boolean;
  verticalColumns: number;
  horizontalColumns: number;
  layoutSizes?: Record<string, { width: number; height: number }>;
}

/** Which channel the trace draws: the speed carried, or the brake pedal itself. */
export type CoachTraceChannel = 'speed' | 'brake';

export interface CoachWidgetSettings {
  /** The advisory call row on top. Off leaves the trace and the readouts alone. */
  showCallRow: boolean;
  /** Draw the speed trace under the call row. Off leaves just the call row, and the plate shrinks to it. */
  showTrace: boolean;
  /** Which pair of traces the chart draws. */
  traceChannel: CoachTraceChannel;
  /** Half-width of the trace window in metres: it spans this far behind and ahead of the car. */
  windowMeters: number;
  /** Brake urgency bar under the call row. */
  showUrgencyBar: boolean;
  /** Judge corner exits on the throttle: how late it was opened and how much pedal is missing. */
  showCornerExitCalls: boolean;
  /** Current speed against the best lap's speed at this point, under the trace. */
  showSpeed: boolean;
  /** Lap time of the stored reference lap the trace is compared against. */
  showReferenceLapTime: boolean;
  /** Which reference is in use right now — the dry one or the wet one. */
  showTrackCondition: boolean;
  brakeColor: string;
  gasColor: string;
  /** Stored best lap the trace is compared against. */
  referenceColor: string;
  /** This lap where it is up on the reference. */
  gainColor: string;
  /** This lap where it is down on the reference. */
  lossColor: string;
}

// Every widget's own settings, in one union. It is not what makes a panel
// type-safe -- a panel gets that from its own `getSettings<T>()` and its local
// `update(partial: Partial<T>)`, and this union happily accepts one widget's key
// on another widget. What it does catch is a key that belongs to no widget at
// all: a typo in a manifest's shipped `userSettings`, or in a direct
// `updateUserSettings` call, plus the wrong value type for a known key. That is
// worth the one line a new widget adds here.
export type WidgetSpecificSettings =
  | Record<never, never> // id: example widget
  | PitServiceWidgetSettings
  | FlagDisplaySettings
  | RpmLightsWidgetSettings
  | InputTraceSettings
  | RadarSettings
  | CloseBattleWidgetSettings
  | StandingsWidgetSettings
  | RelativeWidgetSettings
  | TrackMapWidgetSettings
  | LinearMapWidgetSettings
  | WeatherWidgetSettings
  | FuelWidgetSettings
  | DeltaWidgetSettings
  | SectorMatrixWidgetSettings
  | TimerWidgetSettings
  | GMeterWidgetSettings
  | EnginePanelWidgetSettings
  | RaceDashWidgetSettings
  | InvisibleDashWidgetSettings
  | CoachWidgetSettings
  | StreamChatWidgetSettings;
export interface WidgetMeta {
  id: string;
  label: string;
  description?: string;
  designWidth: number;
  designHeight: number;
  autoHeight?: boolean;
  overflowVisible?: boolean;
  transparentContainer?: boolean;
  /** Resize handles keep designWidth:designHeight ratio locked (e.g. a widget
   * with a circular badge sized off the height). */
  lockAspectRatio?: boolean;
  /** Widget scale (--wfs) follows the height instead of the width, and the
   * e/w handles only stretch the widget without rescaling it — for widgets
   * whose middle section (a chart) is meant to grow horizontally while the
   * fixed-size parts around it stay put. Corner handles still scale the whole
   * widget proportionally; there are no n/s handles. */
  scaleFromHeight?: boolean;
  requiredCapabilities?: (keyof CapabilitiesPayload)[];
}

export interface BaseUserSettings {
  enabled: boolean;
  x: number;
  y: number;
  currentWidth: number;
  currentHeight: number;
  opacity: number;
  /** Multiplier applied to fs() font sizes only — independent of --wfs (width scale). */
  fontScale: number;
  backgroundColor: string;
  borderColor: string;
  zIndex?: number;
}

export type WidgetUserSettings = BaseUserSettings & WidgetSpecificSettings;

export interface LayoutChangeResult {
  designWidth?: number;
  designHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  userSettingsPatch?: Partial<WidgetUserSettings>;
}

export interface LayoutChangeContext {
  designWidth: number;
  designHeight: number;
  currentWidth: number;
  currentHeight: number;
}

export type ResolveLayoutChange = (
  prev: WidgetUserSettings,
  next: WidgetUserSettings,
  current: LayoutChangeContext
) => LayoutChangeResult | null;

/**
 * What a widget declares about itself, in its own `manifest.ts`. Plain data:
 * no React, so the catalog the stores read carries no UI with it. The id →
 * component map lives in `ui/widgets/registry.ts`.
 */
export interface WidgetManifest extends WidgetMeta {
  userSettings: WidgetUserSettings;
  /**
   * Where the widget sits in the catalog list. Shipped widgets are spaced by
   * ten so one can be slotted between two without renumbering; a widget that
   * declares nothing sorts last, and equal numbers fall back to the id.
   */
  order?: number;
  resolveLayoutChange?: ResolveLayoutChange;
  /**
   * High-frequency bundle fields this widget reads. The backend fills them only
   * while some enabled widget of the active layout asks for them — declaring
   * nothing means the widget lives on the fields that are always sent.
   *
   * Get this wrong in the omitting direction and the widget renders stale or
   * empty; in the adding direction it costs everyone else the traffic. Both are
   * why it belongs here rather than in a list somewhere else.
   */
  telemetryEvents?: TelemetryEventName[];
}

export interface WidgetConfig extends WidgetManifest {
  component: React.ComponentType;
}

export type WidgetDefaultConfig = WidgetMeta & {
  userSettings: WidgetUserSettings;
};

export interface LayoutResolution {
  width: number;
  height: number;
}

/** A monitor's placement in virtual-desktop space, in logical (CSS) pixels. */
export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A monitor the layout is spread across. Added explicitly by the user — the
 * machine can have screens a layout ignores. Bounds are kept even while the
 * monitor is unplugged, so the editor can still show and edit that area.
 */
export interface LayoutMonitor {
  name: string;
  bounds: MonitorBounds;
  /**
   * A remote screen is a device on the network rendering the layout in a
   * browser. It behaves as a monitor everywhere it matters — widgets belong to
   * it by their centre point, it gets its own widget set, the editor lays it
   * out — but no overlay window is ever opened for it. Absent means a physical
   * display, so files written before remote screens existed stay valid.
   */
  kind?: 'display' | 'remote';
  /** Remote screens only: the URL segment the device is opened at. */
  slug?: string;
  /**
   * Remote screens only: a device has already reported its size and the screen
   * was matched to it. The first connection fits the screen automatically —
   * the size picked when creating it is a guess — but only the first, so a
   * different device opening the same link, or a browser address bar coming
   * and going, cannot reshuffle a layout the user has already built.
   */
  fittedToDevice?: boolean;
}

export type SessionContext = 'Practice' | 'Qualify' | 'Race' | 'Garage';

export interface SavedLayout {
  id: string;
  name: string;
  createdAt: number;
  /** Background image per monitor name, drawn behind widgets in the editor. */
  backgroundImages?: Record<string, string>;
  /** Monitors this layout covers. One overlay window is opened per monitor. */
  monitors: LayoutMonitor[];
  /**
   * Every widget of the layout, positioned in virtual-desktop space. The
   * monitor a widget belongs to follows from its centre point, so dragging it
   * over an edge reassigns it. Exactly one instance of each widget per layout.
   */
  widgets: WidgetDefaultConfig[];
}

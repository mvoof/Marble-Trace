import type React from 'react';
import type { CapabilitiesPayload } from '@/types/bindings';

type RpmColorTheme = 'custom' | 'gradient' | 'classic';
export type LedShape = 'square' | 'circle' | 'parallelogram';
export type PitBoxSide = 'left' | 'right';

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

export interface RaceDashWidgetSettings {
  pitSpeedLimitOverride: number | null;
  showPitAssist: boolean;
  pitBoxSide: PitBoxSide;
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
  carLength: number;
  qualifyingVisibility: RadarQualifyingVisibility;
  showDistance: boolean;
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

export interface PitServiceWidgetSettings {
  showPitSpeed: boolean;
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
}

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

export interface CoachWidgetSettings {
  /** Draw the speed trace under the call row. Off leaves just the call row, and the plate shrinks to it. */
  showTrace: boolean;
  /** Half-width of the trace window in metres: it spans this far behind and ahead of the car. */
  windowMeters: number;
  /** Brake urgency bar under the call row. */
  showUrgencyBar: boolean;
  brakeColor: string;
  gasColor: string;
  /** Stored best lap the trace is compared against. */
  referenceColor: string;
  /** This lap where it is up on the reference. */
  gainColor: string;
  /** This lap where it is down on the reference. */
  lossColor: string;
}

export type WidgetSpecificSettings =
  | Record<never, never> // id: example widget
  | PitServiceWidgetSettings
  | FlagDisplaySettings
  | RpmLightsWidgetSettings
  | InputTraceSettings
  | RadarSettings
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

export interface WidgetConfig extends WidgetMeta {
  component: React.ComponentType;
  userSettings: WidgetUserSettings;
  resolveLayoutChange?: ResolveLayoutChange;
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

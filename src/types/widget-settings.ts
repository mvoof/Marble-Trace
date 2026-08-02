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
  brakeColor: string;
  gasColor: string;
  showReferenceSpeed: boolean;
  /** Tint the gear digit and RPM number with the zone color at high revs. */
  colorizeByRpmZone: boolean;
  /** 'fill' = colored RPM arc around the ring, 'comb' = discrete ticks on that same ring, 'glow' = rim glows near shift, 'off' = no RPM indication. */
  rpmIndicatorMode: RpmIndicatorMode;
  /** Source of the P-number in the stats strip and the pit block. */
  useLivePositions: boolean;
  /** Steering angle wedge riding the outer rim of the gear ring. */
  showSteeringMarker: boolean;
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
  viewModeHotkey: string;
  classPrevHotkey: string;
  classNextHotkey: string;
  scrollUpHotkey: string;
  scrollDownHotkey: string;
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
}

export interface WeatherWidgetSettings {
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showForecast: boolean;
  showTrackWetness: boolean;
}

export interface FuelWidgetSettings {
  showChart: boolean;
  pitWarningLaps: number;
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

export interface ChassisWidgetSettings {
  showSuspensionAndBrakes: boolean;
  modeWidths?: { chassis?: number; suspensionAndBrakes?: number };
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

export type WidgetSpecificSettings =
  | Record<never, never> // id: example widget
  | ChassisWidgetSettings
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

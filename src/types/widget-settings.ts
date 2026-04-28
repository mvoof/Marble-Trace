export type SpeedWidgetFocusMode = 'speed' | 'gear';
export type RpmColorTheme = 'custom' | 'gradient' | 'classic';

export interface SpeedWidgetSettings {
  focusMode: SpeedWidgetFocusMode;
  rpmColorTheme: RpmColorTheme;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorLimit: string;
}

export type InputTraceBarMode = 'horizontal' | 'vertical' | 'hidden';

export interface InputTraceSettings {
  showThrottle: boolean;
  showBrake: boolean;
  showClutch: boolean;
  throttleColor: string;
  brakeColor: string;
  clutchColor: string;
  barMode: InputTraceBarMode;
}

export type RadarVisibilityMode = 'always' | 'proximity';
export type RadarBarDisplayMode = 'both' | 'active-only';

export interface RadarSettings {
  visibilityMode: RadarVisibilityMode;
  proximityThreshold: number;
  hideDelay: number;
  /** radar-bar: show both bars or only the side with a detected car */
  barDisplayMode?: RadarBarDisplayMode;
}

export interface StandingsWidgetSettings {
  enableClassCycling: boolean;
  classCyclingToggleHotkey: string;
  classPrevHotkey: string;
  classNextHotkey: string;
  showPosChange: boolean;
  showColumnHeaders: boolean;
  showSessionHeader: boolean;
  showWeather: boolean;
  showSOF: boolean;
  showTotalDrivers: boolean;
  showBrand: boolean;
  showTire: boolean;
  showIRatingBadge: boolean;
  showClassBadge: boolean;
  /** Projected iR change column (Elo-based estimate, not real SDK data) */
  showIrChange: boolean;
  /** Player-only pit stop counter (counted on the frontend) */
  showPitStops: boolean;
  showLapsCompleted: boolean;
  abbreviateNames: boolean;
}

export interface RelativeWidgetSettings {
  showIRatingBadge: boolean;
  showClassBadge: boolean;
  showPitIndicator: boolean;
  abbreviateNames: boolean;
}

export type TrackMapLegendPosition = 'left' | 'right' | 'hidden';
export type TrackMapRotationMode = 'fixed' | 'heading-up';
export type TrackMapLeaderLabelMode = 'all' | 'own-class' | 'none';

export interface TrackMapWidgetSettings {
  showLegend: boolean;
  legendPosition: TrackMapLegendPosition;
  showSectors: boolean;
  rotationMode: TrackMapRotationMode;
  playerDotColor: string;
  showPlayerLabel: boolean;
  leaderLabelMode: TrackMapLeaderLabelMode;
  trackStrokePx: number;
  trackBorderPx: number;
  sectorStrokePx: number;
  targetDotRadiusPx: number;
}

export type LinearMapOrientation = 'horizontal' | 'vertical';

export interface LinearMapWidgetSettings {
  orientation: LinearMapOrientation;
  playerDotColor: string;
}

export interface WeatherWidgetSettings {
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showForecast: boolean;
}

export type LapTimesLayout = 'vertical' | 'horizontal';

export interface LapTimesWidgetSettings {
  showLastLap: boolean;
  showBestLap: boolean;
  showP1: boolean;
  layout: LapTimesLayout;
}

export interface FuelWidgetSettings {
  showChart: boolean;
  pitWarningLaps: number;
  chartType: 'line' | 'bar';
}

export type LapDeltaLayout = 'vertical' | 'horizontal';

export interface LapDeltaWidgetSettings {
  layout: LapDeltaLayout;
  showSectorTimes: boolean;
}

export interface TimerWidgetSettings {
  showFlag: boolean;
  showLaps: boolean;
  showPosition: boolean;
}

export interface FlagDisplaySettings {
  alwaysShow: boolean;
  holdDuration: number;
}

export interface ChassisWidgetSettings {
  showInboard: boolean;
}

export interface WidgetCustomSettings {
  chassis?: ChassisWidgetSettings;
  flags?: FlagDisplaySettings;
  'flat-flags'?: FlagDisplaySettings;
  speed?: SpeedWidgetSettings;
  'input-trace'?: InputTraceSettings;
  'proximity-radar'?: RadarSettings;
  'radar-bar'?: RadarSettings;
  standings?: StandingsWidgetSettings;
  relative?: RelativeWidgetSettings;
  'track-map'?: TrackMapWidgetSettings;
  'linear-map'?: LinearMapWidgetSettings;
  weather?: WeatherWidgetSettings;
  fuel?: FuelWidgetSettings;
  'lap-times'?: LapTimesWidgetSettings;
  'lap-delta'?: LapDeltaWidgetSettings;
  timer?: TimerWidgetSettings;
}

export interface WidgetConfig {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  designWidth: number;
  designHeight: number;
  backgroundColor: string;
  backgroundColorEdge: string;
  hotkey: string;
  customSettings?: WidgetCustomSettings;
}

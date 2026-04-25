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

export interface TrackMapWidgetSettings {
  showLegend: boolean;
  legendPosition: TrackMapLegendPosition;
  showSectors: boolean;
  rotationMode: TrackMapRotationMode;
}

export type LinearMapOrientation = 'horizontal' | 'vertical';

export interface LinearMapWidgetSettings {
  orientation: LinearMapOrientation;
}

export type FlagsVariant = 'overlay' | 'under-mirror' | 'standalone';

export interface FlagsWidgetSettings {
  variant: FlagsVariant;
  cutoutWidth: number;
  cutoutHeight: number;
}

export interface WeatherWidgetSettings {
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
}

export interface LapTimesWidgetSettings {
  showLastLap: boolean;
  showBestLap: boolean;
  showP1: boolean;
}

export interface FuelWidgetSettings {
  showChart: boolean;
  pitWarningLaps: number;
  chartType: 'line' | 'bar';
}

export type LapDeltaLayout = 'vertical' | 'horizontal';

export interface LapDeltaWidgetSettings {
  layout: LapDeltaLayout;
}

export interface WidgetCustomSettings {
  speed?: SpeedWidgetSettings;
  'input-trace'?: InputTraceSettings;
  'proximity-radar'?: RadarSettings;
  'radar-bar'?: RadarSettings;
  standings?: StandingsWidgetSettings;
  relative?: RelativeWidgetSettings;
  'track-map'?: TrackMapWidgetSettings;
  'linear-map'?: LinearMapWidgetSettings;
  flags?: FlagsWidgetSettings;
  weather?: WeatherWidgetSettings;
  fuel?: FuelWidgetSettings;
  'lap-times'?: LapTimesWidgetSettings;
  'lap-delta'?: LapDeltaWidgetSettings;
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
  backgroundColor: string;
  backgroundColorEdge: string;
  hotkey: string;
  customSettings?: WidgetCustomSettings;
}

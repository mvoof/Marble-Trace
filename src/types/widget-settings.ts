import type React from 'react';
import type { CapabilitiesPayload } from '@/types/bindings';

type RpmColorTheme = 'custom' | 'gradient' | 'classic';
export type LedShape = 'square' | 'circle';

export interface SpeedWidgetSettings {
  rpmColorTheme: RpmColorTheme;
  rpmColorLow: string;
  rpmColorMid: string;
  rpmColorHigh: string;
  rpmColorShift: string;
  rpmColorLimit: string;
  showRpmBar: boolean;
  showTemps: boolean;
  showRpmColor: boolean;
  pitSpeedLimitOverride: number | null;
  gearColor: string;
  gearPanelBg: string;
  ledShape: LedShape;
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
  steeringLimit: number;
}

export interface RadarSettings {
  proximityThreshold: number;
  hideDelay: number;
  carLength: number;
}

export type StandingsViewMode = 'all' | 'cycling' | 'grouped';

export interface StandingsWidgetSettings {
  viewMode: StandingsViewMode;
  viewModeHotkey: string;
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
}

export interface RelativeWidgetSettings {
  showLicBadge: boolean;
  showIRating: boolean;
  showPitIndicator: boolean;
  abbreviateNames: boolean;
  showDriverFlags: boolean;
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
}

export type LinearMapOrientation = 'horizontal' | 'vertical';

export interface LinearMapWidgetSettings {
  orientation: LinearMapOrientation;
  playerDotColor: string;
  targetDotRadiusPx: number;
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
  chartType: 'line' | 'bar';
  barWidth: number;
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

export interface TimerWidgetSettings {
  showFlag: boolean;
  showLaps: boolean;
  showPosition: boolean;
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

export type WidgetSpecificSettings =
  | Record<never, never> // id: example widget
  | ChassisWidgetSettings
  | FlagDisplaySettings
  | SpeedWidgetSettings
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
  | GMeterWidgetSettings;
export interface WidgetMeta {
  id: string;
  label: string;
  description?: string;
  designWidth: number;
  designHeight: number;
  autoHeight?: boolean;
  overflowVisible?: boolean;
  requiredCapabilities?: (keyof CapabilitiesPayload)[];
}

export interface BaseUserSettings {
  enabled: boolean;
  x: number;
  y: number;
  currentWidth: number;
  currentHeight: number;
  opacity: number;
  backgroundColor: string;
  borderColor: string;
  hotkey: string;
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

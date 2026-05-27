import { TelemetryDebugWidget } from '@widgets/TelemetryDebugWidget/TelemetryDebugWidget';
import { SpeedWidget } from '@widgets/SpeedWidget/SpeedWidget';
import { InputTraceWidget } from '@widgets/InputTraceWidget/InputTraceWidget';
import { ProximityRadarWidget } from '@widgets/ProximityRadarWidget/ProximityRadarWidget';
import { RadarBarWidget } from '@widgets/RadarBarWidget/RadarBarWidget';
import { StandingsWidget } from '@widgets/StandingsWidget/StandingsWidget';
import { RelativeWidget } from '@widgets/RelativeWidget/RelativeWidget';
import { TrackMapWidget } from '@widgets/TrackMapWidget/TrackMapWidget';
import { RelativeMapWidget } from '@widgets/RelativeMapWidget/RelativeMapWidget';
import { LedFlagWidget } from '@widgets/LedFlagWidget/LedFlagWidget';
import { ChassisWidget } from '@widgets/ChassisWidget/ChassisWidget';
import { DeltaWidget } from '@widgets/DeltaWidget/DeltaWidget';
import { TimerWidget } from '@widgets/TimerWidget/TimerWidget';
import { WeatherWidget } from '@widgets/WeatherWidget/WeatherWidget';
import { FuelWidget } from '@widgets/FuelWidget/FuelWidget';
import { FlatFlagsWidget } from '@widgets/FlatFlagsWidget/FlatFlagsWidget';
import { GMeterWidget } from '@widgets/GMeterWidget/GMeterWidget';
import { SectorMatrixWidget } from '@widgets/SectorMatrixWidget/SectorMatrixWidget';
import { LapLogWidget } from '@widgets/LapLogWidget/LapLogWidget';
import type {
  WidgetConfig,
  WidgetDefaultConfig,
  ResolveLayoutChange,
} from '@/types/widget-settings';

// Swaps width<->height when orientation changes (horizontal<->vertical rotation).
// designWidth/Height are taken from LINEAR_MAP_SIZES to match the new orientation's reference size.
const resolveRelativeMapLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('orientation' in next) || !next.orientation) return null;

  const prevOrientation = 'orientation' in prev ? prev.orientation : undefined;

  if (prevOrientation === next.orientation) return null;

  const size = LINEAR_MAP_SIZES[next.orientation];

  if (!size) return null;

  return {
    designWidth: size.designWidth,
    designHeight: size.designHeight,
    currentWidth: current.currentHeight,
    currentHeight: current.currentWidth,
  };
};

// Resets widget to the fixed reference size for the new barMode.
// hidde->vertical only: switching to hidden doesn't resize (the bar just disappears visually).
const resolveInputTraceLayout: ResolveLayoutChange = (prev, next) => {
  if (!('barMode' in next) || !next.barMode) return null;

  const prevBarMode = 'barMode' in prev ? prev.barMode : 'vertical';

  if (prevBarMode === next.barMode || next.barMode === 'hidden') return null;

  const size = INPUT_TRACE_SIZES[next.barMode];

  if (!size) return null;

  return {
    designWidth: size.designWidth,
    designHeight: size.designHeight,
    currentWidth: size.designWidth,
    currentHeight: size.designHeight,
  };
};

const CHASSIS_DESIGN_WIDTH = 300;
const CHASSIS_WITH_SUSPENSION_DESIGN_WIDTH = 430;
const CHASSIS_DEFAULT_WIDTH = 280;
const CHASSIS_WITH_SUSPENSION_DEFAULT_WIDTH = 400;

// Same width-memory pattern as makeLayoutSwapResolver but triggered by a boolean
// (showSuspensionAndBrakes) instead of a layout string. Saves width per mode in
// `modeWidths` so the user's resize is preserved on toggle.
const resolveChassisLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('showSuspensionAndBrakes' in next)) return null;

  const prevShow =
    'showSuspensionAndBrakes' in prev ? prev.showSuspensionAndBrakes : false;
  const nextShow = next.showSuspensionAndBrakes;

  if (prevShow === nextShow) return null;

  const prevMode = prevShow ? 'suspensionAndBrakes' : 'chassis';
  const nextMode = nextShow ? 'suspensionAndBrakes' : 'chassis';

  const prevModeWidths = 'modeWidths' in prev ? (prev.modeWidths ?? {}) : {};

  const savedModeWidths = {
    ...prevModeWidths,
    [prevMode]: current.currentWidth,
  };

  const defaultNextWidth = nextShow
    ? CHASSIS_WITH_SUSPENSION_DEFAULT_WIDTH
    : CHASSIS_DEFAULT_WIDTH;

  const nextWidth = savedModeWidths[nextMode] ?? defaultNextWidth;

  return {
    designWidth: nextShow
      ? CHASSIS_WITH_SUSPENSION_DESIGN_WIDTH
      : CHASSIS_DESIGN_WIDTH,
    currentWidth: nextWidth,
    userSettingsPatch: { modeWidths: savedModeWidths },
  };
};

export const LINEAR_MAP_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  horizontal: { designWidth: 400, designHeight: 40 },
  vertical: { designWidth: 40, designHeight: 400 },
};

export const INPUT_TRACE_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  vertical: { designWidth: 400, designHeight: 110 },
};

export const WIDGETS: WidgetConfig[] = [
  {
    id: 'speed',
    label: 'Speed',
    description: 'Speedometer with gear and RPM indicator.',
    component: SpeedWidget,
    designWidth: 500,
    designHeight: 120,
    userSettings: {
      enabled: true,
      x: 400,
      y: 100,
      currentWidth: 500,
      currentHeight: 120,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      rpmColorTheme: 'custom',
      rpmColorLow: '#22c55e',
      rpmColorMid: '#fbbf24',
      rpmColorHigh: '#ef4444',
      rpmColorShift: '#a855f7',
      rpmColorLimit: '#ff4d00',
      showRpmBar: true,
      showTemps: true,
      showRpmColor: true,
      pitSpeedLimitOverride: null,
      gearColor: '#fbbf24',
      gearPanelBg: 'rgba(255,255,255,0.05)',
      ledShape: 'square',
    },
  },
  {
    id: 'input-trace',
    label: 'Input Trace',
    description: 'Live throttle, brake, and clutch inputs.',
    resolveLayoutChange: resolveInputTraceLayout,
    component: InputTraceWidget,
    designWidth: 400,
    designHeight: 220,
    userSettings: {
      enabled: false,
      x: 400,
      y: 300,
      currentWidth: 400,
      currentHeight: 220,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showThrottle: true,
      showBrake: true,
      showClutch: true,
      throttleColor: '#00ff00',
      brakeColor: '#ff3333',
      clutchColor: '#3399ff',
      barMode: 'vertical',
      historySeconds: 5,
      lineWidth: 3.5,
      smoothing: 0,
    },
  },
  {
    id: 'proximity-radar',
    label: 'Proximity Radar',
    description: 'Visual radar for nearby traffic.',
    component: ProximityRadarWidget,
    designWidth: 200,
    designHeight: 300,
    userSettings: {
      enabled: false,
      x: 600,
      y: 300,
      currentWidth: 200,
      currentHeight: 300,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      proximityThreshold: 5,
      hideDelay: 2,
    },
  },
  {
    id: 'radar-bar',
    label: 'Radar Bar',
    description: 'Full-width side proximity indicators.',
    component: RadarBarWidget,
    designWidth: 800,
    designHeight: 380,
    userSettings: {
      enabled: false,
      x: 200,
      y: 300,
      currentWidth: 800,
      currentHeight: 380,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      proximityThreshold: 3,
      hideDelay: 2,
    },
  },
  {
    id: 'standings',
    label: 'Standings',
    description: 'Live session standings and intervals.',
    component: StandingsWidget,
    designWidth: 760,
    designHeight: 450,
    userSettings: {
      enabled: false,
      x: 50,
      y: 50,
      currentWidth: 760,
      currentHeight: 450,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      enableClassCycling: false,
      classCyclingToggleHotkey: '',
      classPrevHotkey: '',
      classNextHotkey: '',
      showPosChange: true,
      showColumnHeaders: true,
      showSessionHeader: true,
      showWeather: true,
      showSOF: true,
      showTotalDrivers: true,
      showBrand: true,
      showTire: true,
      showIRatingBadge: true,
      showClassBadge: true,
      showIrChange: false,
      showPitStops: true,
      showLapsCompleted: false,
      showIncidentsBadge: true,
      abbreviateNames: false,
    },
  },
  {
    id: 'relative',
    label: 'Relative',
    description: 'Gaps to cars ahead and behind you.',
    component: RelativeWidget,
    designWidth: 460,
    designHeight: 400,
    userSettings: {
      enabled: false,
      x: 50,
      y: 300,
      currentWidth: 460,
      currentHeight: 400,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showIRatingBadge: true,
      showClassBadge: true,
      showPitIndicator: true,
      abbreviateNames: true,
      showTrendIcon: true,
    },
  },
  {
    id: 'track-map',
    label: 'Track Map',
    description: 'Dynamic 2D map of the current circuit.',
    component: TrackMapWidget,
    designWidth: 400,
    designHeight: 400,
    userSettings: {
      enabled: false,
      x: 800,
      y: 50,
      currentWidth: 400,
      currentHeight: 400,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      showSectors: true,
      showSectorsOnMap: true,
      rotationMode: 'fixed',
      playerDotColor: '#ffffff',
      showPlayerLabel: true,
      leaderLabelMode: 'all',
      trackStrokePx: 10,
      trackBorderPx: 3,
      sectorStrokePx: 6,
      targetDotRadiusPx: 10,
    },
  },
  {
    id: 'relative-map',
    label: 'Relative Map',
    description: 'Progress bar of car track positions.',
    resolveLayoutChange: resolveRelativeMapLayout,
    component: RelativeMapWidget,
    designWidth: 400,
    designHeight: 40,
    userSettings: {
      enabled: false,
      x: 50,
      y: 820,
      currentWidth: 400,
      currentHeight: 40,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      orientation: 'horizontal',
      playerDotColor: '#ffffff',
      targetDotRadiusPx: 10,
    },
  },
  {
    id: 'led-flags',
    label: 'LED Flags',
    description: 'LED matrix display of track flags.',
    component: LedFlagWidget,
    designWidth: 232,
    designHeight: 232,
    userSettings: {
      enabled: false,
      x: 760,
      y: 0,
      currentWidth: 232,
      currentHeight: 232,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      alwaysShow: true,
      holdDuration: 3,
    },
  },
  {
    id: 'flat-flags',
    label: 'Flat Flags',
    description: 'Banner-style list of active track flags.',
    component: FlatFlagsWidget,
    autoHeight: true,
    designWidth: 280,
    designHeight: 160,
    userSettings: {
      enabled: false,
      x: 760,
      y: 250,
      currentWidth: 280,
      currentHeight: 160,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      alwaysShow: true,
      holdDuration: 3,
    },
  },
  {
    id: 'chassis',
    label: 'Chassis',
    description: 'Tire pressures and brake temperatures.',
    resolveLayoutChange: resolveChassisLayout,
    component: ChassisWidget,
    designWidth: 300,
    designHeight: 290,
    userSettings: {
      enabled: false,
      x: 100,
      y: 100,
      currentWidth: 280,
      currentHeight: 290,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showSuspensionAndBrakes: false,
      modeWidths: {},
    },
  },
  {
    id: 'example',
    label: 'Telemetry Debug',
    description: 'Raw telemetry data debugger.',
    component: TelemetryDebugWidget,
    designWidth: 400,
    designHeight: 700,
    userSettings: {
      enabled: false,
      x: 100,
      y: 100,
      currentWidth: 400,
      currentHeight: 700,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
    },
  },
  {
    id: 'delta',
    label: 'Delta HUD',
    description: 'Live delta HUD — one glance, am I faster or slower?',
    component: DeltaWidget,
    designWidth: 520,
    designHeight: 96,
    userSettings: {
      enabled: false,
      x: 400,
      y: 200,
      currentWidth: 520,
      currentHeight: 96,
      opacity: 1,
      backgroundColor: 'transparent',
      backgroundColorEdge: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      reference: 'personal_best',
      showLapFlash: false,
      flashDuration: 5,
      hideWhenNoReference: false,
    },
  },
  {
    id: 'timer',
    label: 'Timer',
    description: 'Stint and total session timers.',
    component: TimerWidget,
    designWidth: 240,
    designHeight: 120,
    userSettings: {
      enabled: false,
      x: 50,
      y: 310,
      currentWidth: 240,
      currentHeight: 120,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showFlag: true,
      showLaps: true,
      showPosition: true,
      showWallClock: true,
      showSimTime: true,
      showPcDate: false,
      showSimDate: true,
    },
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Track conditions and wind information.',
    component: WeatherWidget,
    designWidth: 200,
    designHeight: 240,
    userSettings: {
      enabled: false,
      x: 760,
      y: 200,
      currentWidth: 200,
      currentHeight: 240,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showCompass: true,
      showAirTemp: true,
      showTrackTemp: true,
      showWind: true,
      showHumidity: true,
      showForecast: true,
    },
  },
  {
    id: 'fuel',
    label: 'Fuel',
    description: 'Fuel level and consumption calculator.',
    component: FuelWidget,
    autoHeight: true,
    designWidth: 240,
    designHeight: 360,
    userSettings: {
      enabled: false,
      x: 760,
      y: 500,
      currentWidth: 240,
      currentHeight: 360,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showChart: false,
      pitWarningLaps: 3,
      chartType: 'bar',
      barWidth: 5,
    },
  },
  {
    id: 'g-meter',
    label: 'G-Meter',
    description: 'Lateral and longitudinal G-force friction circle.',
    component: GMeterWidget,
    designWidth: 240,
    designHeight: 280,
    userSettings: {
      enabled: true,
      x: 100,
      y: 100,
      currentWidth: 240,
      currentHeight: 280,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      displayMode: 'fading',
      scale: 4,
      colorMode: 'advanced',
    },
  },
  {
    id: 'sector-matrix',
    label: 'Sector Matrix',
    description:
      'Sector-by-sector timing with progress bar, live delta per sector, LAST and BEST.',
    component: SectorMatrixWidget,
    autoHeight: true,
    designWidth: 320,
    designHeight: 180,
    userSettings: {
      enabled: false,
      x: 100,
      y: 300,
      currentWidth: 320,
      currentHeight: 180,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      reference: 'personal_best',
      showPredicted: true,
      showSectors: true,
    },
  },
  {
    id: 'lap-log',
    label: 'Lap Log',
    description:
      'Last 8 laps with time and delta vs personal best. Best lap highlighted.',
    component: LapLogWidget,
    autoHeight: true,
    designWidth: 220,
    designHeight: 260,
    userSettings: {
      enabled: false,
      x: 700,
      y: 300,
      currentWidth: 220,
      currentHeight: 260,
      opacity: 1,
      backgroundColor: '#252525',
      backgroundColorEdge: '#14141b',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
    },
  },
];

export const WIDGET_BY_ID = new Map(
  WIDGETS.map((widgetConfig) => [widgetConfig.id, widgetConfig])
);

const NON_SERIALIZABLE_WIDGET_KEYS = new Set([
  'component',
  'resolveLayoutChange',
]);

export const DEFAULT_WIDGETS: WidgetDefaultConfig[] = WIDGETS.map(
  (currentWidget) => {
    const allowedEntries = Object.entries(currentWidget).filter(([key]) => {
      return !NON_SERIALIZABLE_WIDGET_KEYS.has(key);
    });

    return Object.fromEntries(allowedEntries) as WidgetDefaultConfig;
  }
);

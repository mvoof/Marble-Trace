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
  StandingsWidgetSettings,
  RelativeWidgetSettings,
  InputTraceSettings,
  FlagDisplaySettings,
} from '@/types/widget-settings';
import { computeStandingsDesignWidth } from '@utils/widget/standings-utils';
import { computeRelativeDesignWidth } from '@utils/widget/relative-utils';

// Widgets with toggleable columns/sections have a natural width that changes as
// elements are shown/hidden. This builds a resolveLayoutChange that, when any of
// the given toggle keys flips, recomputes designWidth from the visible content AND
// scales currentWidth by the same factor — keeping --wfs (and thus font/row size)
// constant while the widget grows/shrinks to fit. Only WIDTH-changing toggles need
// this; height-changing toggles don't affect --wfs (width-only).
const makeColumnLayoutResolver = <Settings>(
  toggleKeys: (keyof Settings)[],
  computeDesignWidth: (settings: Settings) => number
): ResolveLayoutChange => {
  return (prev, next, current) => {
    const prevSettings = prev as unknown as Settings;
    const nextSettings = next as unknown as Settings;

    const changed = toggleKeys.some(
      (key) => prevSettings[key] !== nextSettings[key]
    );

    if (!changed) {
      return null;
    }

    const newDesignWidth = computeDesignWidth(nextSettings);
    const scale = current.designWidth
      ? current.currentWidth / current.designWidth
      : 1;

    return {
      designWidth: newDesignWidth,
      currentWidth: Math.round(newDesignWidth * scale),
    };
  };
};

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

// Layout constants matching JSX/SCSS values in InputTraceWidget.
// Bar width = rem(18) @ 16px base = 18px; bar gap = $space-sm = rem(4) = 4px.
// WidgetPanel gap={8} raw px; edgeInset padding: 2px × 2 = 4px total.
// Wheel natural width = designHeight (aspect-ratio 1:1, height: 100%).
// INPUT_TRACE_CHART_DESIGN_PX chosen so all-visible defaults sum to 520px.
const INPUT_TRACE_BAR_PX = 18;
const INPUT_TRACE_BAR_GAP_PX = 4;
const INPUT_TRACE_WHEEL_PX = 120;
const INPUT_TRACE_PANEL_GAP_PX = 8;
const INPUT_TRACE_EDGE_PX = 4;
const INPUT_TRACE_CHART_DESIGN_PX = 318;

const computeInputTraceDesignWidth = (settings: InputTraceSettings): number => {
  const barCount = [
    settings.showThrottle,
    settings.showBrake,
    settings.showClutch,
  ].filter(Boolean).length;
  const hasBars = barCount > 0;
  const barsWidth = hasBars
    ? barCount * INPUT_TRACE_BAR_PX +
      Math.max(0, barCount - 1) * INPUT_TRACE_BAR_GAP_PX
    : 0;

  const sections: number[] = [];

  if (settings.showTrace) {
    sections.push(INPUT_TRACE_CHART_DESIGN_PX);
  }

  if (hasBars) {
    sections.push(barsWidth);
  }

  if (settings.showSteering) {
    sections.push(INPUT_TRACE_WHEEL_PX);
  }

  if (sections.length === 0) {
    return 520;
  }

  const gaps = Math.max(0, sections.length - 1) * INPUT_TRACE_PANEL_GAP_PX;

  return Math.round(
    sections.reduce((sum, width) => sum + width, 0) + gaps + INPUT_TRACE_EDGE_PX
  );
};

const resolveInputTraceLayout = makeColumnLayoutResolver<InputTraceSettings>(
  ['showTrace', 'showSteering', 'showThrottle', 'showBrake', 'showClutch'],
  computeInputTraceDesignWidth
);

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

const resolveLedFlagsLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('split' in next)) return null;

  const prevSettings = prev as unknown as FlagDisplaySettings;
  const nextSettings = next as unknown as FlagDisplaySettings;

  const prevSplit = !!prevSettings.split;
  const nextSplit = !!nextSettings.split;

  if (prevSplit === nextSplit) return null;

  const prevMode = prevSplit ? 'split' : 'single';
  const nextMode = nextSplit ? 'split' : 'single';

  const prevModeWidths =
    'modeWidths' in prev
      ? ((prev.modeWidths as Record<string, number>) ?? {})
      : {};

  const savedModeWidths: Record<string, number> = {
    ...prevModeWidths,
    [prevMode]: current.currentWidth,
  };

  const defaultNextWidth = nextSplit ? 696 : 232;
  const nextWidth = savedModeWidths[nextMode] ?? defaultNextWidth;

  return {
    designWidth: nextSplit ? 696 : 232,
    currentWidth: nextWidth,
    userSettingsPatch: { modeWidths: savedModeWidths },
  };
};

const resolveStandingsLayout =
  makeColumnLayoutResolver<StandingsWidgetSettings>(
    [
      'showLicBadge',
      'showIRating',
      'showIrChange',
      'showLapsCompleted',
      'showPosChange',
      'showBrand',
      'showTire',
    ],
    computeStandingsDesignWidth
  );

const resolveRelativeLayout = makeColumnLayoutResolver<RelativeWidgetSettings>(
  ['showLicBadge', 'showIRating'],
  computeRelativeDesignWidth
);

// Default column visibility kept as a single source: the natural designWidth is
// computed from it (so it can't drift from the colSpecs in *-utils.ts), and the
// same object is spread into the widget's userSettings below.
const STANDINGS_COLUMN_DEFAULTS = {
  showPosChange: true,
  showBrand: true,
  showTire: true,
  showLicBadge: true,
  showIRating: true,
  showIrChange: true,
  showLapsCompleted: true,
};
const STANDINGS_DESIGN_WIDTH = computeStandingsDesignWidth(
  STANDINGS_COLUMN_DEFAULTS as unknown as StandingsWidgetSettings
);

const RELATIVE_COLUMN_DEFAULTS = {
  showLicBadge: true,
  showIRating: true,
};
const RELATIVE_DESIGN_WIDTH = computeRelativeDesignWidth(
  RELATIVE_COLUMN_DEFAULTS as unknown as RelativeWidgetSettings
);

const INPUT_TRACE_VISIBILITY_DEFAULTS = {
  showTrace: true,
  showSteering: true,
  showThrottle: true,
  showBrake: true,
  showClutch: true,
};
const INPUT_TRACE_DESIGN_WIDTH = computeInputTraceDesignWidth(
  INPUT_TRACE_VISIBILITY_DEFAULTS as unknown as InputTraceSettings
);

export const LINEAR_MAP_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  horizontal: { designWidth: 400, designHeight: 40 },
  vertical: { designWidth: 40, designHeight: 400 },
};

const WIDGETS: WidgetConfig[] = [
  {
    id: 'speed',
    label: 'Speed',
    description: 'Speedometer with gear and RPM indicator.',
    component: SpeedWidget,
    requiredCapabilities: ['playerDynamics'],
    designWidth: 500,
    designHeight: 120,
    userSettings: {
      enabled: false,
      x: 400,
      y: 100,
      currentWidth: 500,
      currentHeight: 120,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      rpmColorTheme: 'custom',
      rpmColorLow: '#10b981',
      rpmColorMid: '#eab308',
      rpmColorHigh: '#ef4444',
      rpmColorShift: '#a855f7',
      rpmColorLimit: '#f97316',
      showRpmBar: true,
      showTemps: true,
      showRpmColor: true,
      pitSpeedLimitOverride: null,
      gearColor: '#eab308',
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
    requiredCapabilities: ['inputs'],
    designWidth: INPUT_TRACE_DESIGN_WIDTH,
    designHeight: 120,
    userSettings: {
      enabled: false,
      x: 400,
      y: 300,
      currentWidth: INPUT_TRACE_DESIGN_WIDTH,
      ...INPUT_TRACE_VISIBILITY_DEFAULTS,
      currentHeight: 120,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      steeringCenterDisplay: 'logo',
      throttleColor: '#10b981',
      brakeColor: '#ef4444',
      clutchColor: '#3b82f6',
      absColor: '#eab308',
      historySeconds: 5,
      lineWidth: 3.5,
      smoothing: 0,
      steeringLimit: 900,
      steeringZoom: 1,
    },
  },
  {
    id: 'proximity-radar',
    label: 'Proximity Radar',
    description: 'Visual radar for nearby traffic.',
    component: ProximityRadarWidget,
    requiredCapabilities: ['radar'],
    designWidth: 200,
    designHeight: 300,
    userSettings: {
      enabled: true,
      x: 600,
      y: 300,
      currentWidth: 200,
      currentHeight: 300,
      opacity: 1,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      hotkey: '',
      proximityThreshold: 5,
      hideDelay: 2,
      carLength: 4.4,
      qualifyingVisibility: 'auto',
    },
  },
  {
    id: 'radar-bar',
    label: 'Radar Bar',
    description: 'Full-width side proximity indicators.',
    component: RadarBarWidget,
    requiredCapabilities: ['radar'],
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
      borderColor: 'transparent',
      hotkey: '',
      proximityThreshold: 3,
      hideDelay: 2,
      carLength: 4.4,
      qualifyingVisibility: 'auto',
    },
  },
  {
    id: 'standings',
    label: 'Standings',
    description: 'Live session standings and intervals.',
    component: StandingsWidget,
    resolveLayoutChange: resolveStandingsLayout,
    requiredCapabilities: ['standings'],
    designWidth: STANDINGS_DESIGN_WIDTH,
    designHeight: 500,
    userSettings: {
      enabled: true,
      x: 50,
      y: 50,
      currentWidth: STANDINGS_DESIGN_WIDTH,
      currentHeight: 500,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      rowPadding: 'narrow',
      viewMode: 'all',
      viewModeHotkey: '',
      classPrevHotkey: '',
      classNextHotkey: '',
      ...STANDINGS_COLUMN_DEFAULTS,
      showColumnHeaders: true,
      showSessionHeader: true,
      showWeather: true,
      showSOF: true,
      showTotalDrivers: true,
      showPitStops: true,
      showIncidentsBadge: true,
      abbreviateNames: false,
      showDriverFlags: true,
    },
  },
  {
    id: 'relative',
    label: 'Relative',
    description: 'Gaps to cars ahead and behind you.',
    component: RelativeWidget,
    resolveLayoutChange: resolveRelativeLayout,
    requiredCapabilities: ['relative'],
    designWidth: RELATIVE_DESIGN_WIDTH,
    designHeight: 400,
    userSettings: {
      enabled: true,
      x: 50,
      y: 300,
      currentWidth: RELATIVE_DESIGN_WIDTH,
      currentHeight: 400,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      rowPadding: 'narrow',
      ...RELATIVE_COLUMN_DEFAULTS,
      showPitIndicator: true,
      abbreviateNames: true,
      showDriverFlags: true,
    },
  },
  {
    id: 'track-map',
    label: 'Track Map',
    description: 'Dynamic 2D map of the current circuit.',
    component: TrackMapWidget,
    requiredCapabilities: ['playerDynamics'],
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
      borderColor: 'transparent',
      hotkey: '',
      showSectors: true,
      showSectorsOnMap: true,
      rotationMode: 'fixed',
      playerDotColor: '#18181b',
      showPlayerLabel: true,
      leaderLabelMode: 'all',
      trackStrokePx: 10,
      trackBorderPx: 3,
      sectorStrokePx: 6,
      targetDotRadiusPx: 10,
      showStartFinish: true,
    },
  },
  {
    id: 'relative-map',
    label: 'Relative Map',
    description: 'Progress bar of car track positions.',
    resolveLayoutChange: resolveRelativeMapLayout,
    component: RelativeMapWidget,
    requiredCapabilities: ['relative'],
    designWidth: 400,
    designHeight: 40,
    userSettings: {
      enabled: false,
      x: 50,
      y: 820,
      currentWidth: 400,
      currentHeight: 40,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      orientation: 'horizontal',
      playerDotColor: '#18181b',
      targetDotRadiusPx: 10,
    },
  },
  {
    id: 'led-flags',
    label: 'LED Flags',
    description: 'LED matrix display of track flags.',
    component: LedFlagWidget,
    resolveLayoutChange: resolveLedFlagsLayout,
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
      borderColor: 'transparent',
      hotkey: '',
      alwaysShow: true,
      holdDuration: 3,
      split: false,
      animate: true,
      forceSingleLed: false,
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
    requiredCapabilities: ['chassis'],
    designWidth: 300,
    designHeight: 290,
    userSettings: {
      enabled: false,
      x: 100,
      y: 100,
      currentWidth: 280,
      currentHeight: 290,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
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
    requiredCapabilities: ['playerDynamics'],
    designWidth: 400,
    designHeight: 700,
    userSettings: {
      enabled: false,
      x: 100,
      y: 100,
      currentWidth: 400,
      currentHeight: 700,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
    },
  },
  {
    id: 'delta',
    label: 'Delta HUD',
    description: 'Live delta HUD — one glance, am I faster or slower?',
    component: DeltaWidget,
    requiredCapabilities: ['sectors'],
    designWidth: 200,
    designHeight: 100,
    userSettings: {
      enabled: false,
      x: 400,
      y: 200,
      currentWidth: 200,
      currentHeight: 100,
      opacity: 1,
      backgroundColor: 'transparent',
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
    autoHeight: true,
    requiredCapabilities: ['playerDynamics'],
    designWidth: 240,
    designHeight: 120,
    userSettings: {
      enabled: false,
      x: 50,
      y: 310,
      currentWidth: 240,
      currentHeight: 120,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showSessionType: true,
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
    autoHeight: true,
    requiredCapabilities: ['weatherCurrent'],
    designWidth: 200,
    designHeight: 240,
    userSettings: {
      enabled: false,
      x: 760,
      y: 200,
      currentWidth: 200,
      currentHeight: 240,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
      showCompass: true,
      showAirTemp: true,
      showTrackTemp: true,
      showWind: true,
      showHumidity: true,
      showForecast: true,
      showTrackWetness: true,
    },
  },
  {
    id: 'fuel',
    label: 'Fuel',
    description: 'Fuel level and consumption calculator.',
    component: FuelWidget,
    requiredCapabilities: ['fuel'],
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
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
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
    requiredCapabilities: ['playerDynamics'],
    designWidth: 240,
    designHeight: 280,
    userSettings: {
      enabled: false,
      x: 100,
      y: 100,
      currentWidth: 240,
      currentHeight: 280,
      opacity: 1,
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
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
    requiredCapabilities: ['sectors'],
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
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      hotkey: '',
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
    requiredCapabilities: ['playerDynamics'],
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
      backgroundColor: 'rgba(21, 22, 26, 0.8)',
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

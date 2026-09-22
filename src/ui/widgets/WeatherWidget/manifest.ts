import type {
  WeatherWidgetSettings,
  WidgetManifest,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';

// The tall layout is a column; the horizontal one lays the same blocks out as
// rows, so it needs roughly twice the width to keep the same type sizes.
const TALL_DESIGN_WIDTH = 200;
const HORIZONTAL_DESIGN_WIDTH = 340;

export const WEATHER_MANIFEST: WidgetManifest = {
  id: 'weather',
  order: 150,
  previewScenarios: ['rain', 'heavy-rain'],
  telemetryEvents: ['carDynamics'],
  label: 'Weather',
  description: 'Track conditions and wind information.',
  autoHeight: true,
  requiredCapabilities: ['weatherCurrent'],
  designWidth: TALL_DESIGN_WIDTH,
  designHeight: 240,
  userSettings: {
    enabled: false,
    x: 760,
    y: 200,
    currentWidth: TALL_DESIGN_WIDTH,
    currentHeight: 240,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showCompass: true,
    showCompassRing: true,
    showAirTemp: true,
    showTrackTemp: true,
    showWind: true,
    showHumidity: true,
    showForecast: true,
    showTrackWetness: true,
    showWindBearing: true,
    horizontal: false,
  },
  resolveLayoutChange: makeExactColumnLayoutResolver<WeatherWidgetSettings>(
    ['horizontal'],
    (settings) =>
      settings.horizontal ? HORIZONTAL_DESIGN_WIDTH : TALL_DESIGN_WIDTH
  ),
};

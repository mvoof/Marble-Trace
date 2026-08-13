import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const WEATHER_MANIFEST: WidgetManifest = {
  id: 'weather',
  label: 'Weather',
  description: 'Track conditions and wind information.',
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
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showCompass: true,
    showAirTemp: true,
    showTrackTemp: true,
    showWind: true,
    showHumidity: true,
    showForecast: true,
    showTrackWetness: true,
    showWindBearing: true,
  },
};

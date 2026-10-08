import type { WidgetMount } from '@widgets/widget-mount';
import { WEATHER_MANIFEST } from './manifest';
import { WeatherWidget } from './WeatherWidget';

export const mount: WidgetMount = {
  id: WEATHER_MANIFEST.id,
  component: WeatherWidget,
};

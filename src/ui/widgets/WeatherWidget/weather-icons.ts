import { Sun, CloudSun, Cloud, CloudRain } from 'lucide-react';

import { getWeatherIcon } from '@utils/weather-utils';

const ICON_BY_NAME = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
};

/** The lucide icon a sky (and, when it rains, a wetness) is drawn with. */
export const weatherIconFor = (
  skies: string | number | null | undefined,
  wetness: number | null | undefined
) => ICON_BY_NAME[getWeatherIcon(skies, wetness)] ?? Sun;

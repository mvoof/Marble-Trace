import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';
import { DEFAULT_PIT_WARNING_LAPS } from '@utils/backend-constants';
import { FUEL_AVG_WINDOW_ALL_LAPS } from '@utils/fuel-constants';

export const FUEL_MANIFEST: WidgetManifest = {
  id: 'fuel',
  label: 'Fuel',
  description: 'Fuel level and consumption calculator.',
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
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showChart: false,
    pitWarningLaps: DEFAULT_PIT_WARNING_LAPS,
    fuelAvgWindow: FUEL_AVG_WINDOW_ALL_LAPS,
    showNextStopForecast: true,
    chartType: 'bar',
    barWidth: 5,
    showStatLast: true,
    showStatAvg10: true,
    showStatMin: true,
    showStatMax: true,
  },
};

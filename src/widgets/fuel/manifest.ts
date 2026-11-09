import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { FUEL_SETTINGS } from './settings-schema';

export const FUEL_MANIFEST: WidgetManifest = {
  id: 'fuel',
  previewScenarios: ['fuel-pit-window', 'fuel-short', 'fuel-refuel-calc'],
  label: 'Fuel',
  description: 'Fuel level and consumption calculator.',
  requiredCapabilities: ['fuel'],
  autoHeight: true,
  // The mockup's card: its type sizes are set against this width.
  designWidth: 306,
  designHeight: 350,
  userSettings: {
    enabled: false,
    x: 760,
    y: 500,
    currentWidth: 306,
    currentHeight: 350,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...FUEL_SETTINGS.defaults,
  },
  settingsSchema: FUEL_SETTINGS,
};

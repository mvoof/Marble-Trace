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
    ...FUEL_SETTINGS.defaults,
  },
  settingsSchema: FUEL_SETTINGS,
};

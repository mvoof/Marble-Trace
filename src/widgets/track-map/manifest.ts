import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { TRACK_MAP_SETTINGS } from './settings-schema';

export const TRACK_MAP_MANIFEST: WidgetManifest = {
  id: 'track-map',
  telemetryEvents: ['carPositions', 'driverEntries', 'incidents'],
  label: 'Track Map',
  description: 'Dynamic 2D map of the current circuit.',
  requiredCapabilities: ['playerDynamics'],
  previewScenarios: ['pace-car-on-track', 'incident-zones'],
  designWidth: 400,
  designHeight: 400,
  userSettings: {
    enabled: false,
    x: 800,
    y: 50,
    currentWidth: 400,
    currentHeight: 400,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    ...TRACK_MAP_SETTINGS.defaults,
  },
  settingsSchema: TRACK_MAP_SETTINGS,
};

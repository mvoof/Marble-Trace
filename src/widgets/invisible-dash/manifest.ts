import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { INVISIBLE_DASH_SETTINGS } from './settings-schema';

export const INVISIBLE_DASH_MANIFEST: WidgetManifest = {
  id: 'invisible-dash',
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Invisible Dash',
  description:
    'Windscreen projection: engine column and gear on the left, position and lap on the right, empty in the middle.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 900,
  designHeight: 200,
  transparentContainer: true,
  // Width is the spread between the two clusters, not a scale: narrowing the
  // dash has to eat the empty middle and leave the digits the size they were.
  // That leaves the height as what the readout is sized from.
  scaleFromHeight: true,
  userSettings: {
    enabled: false,
    x: 300,
    y: 500,
    currentWidth: 900,
    currentHeight: 200,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    ...INVISIBLE_DASH_SETTINGS.defaults,
  },
  settingsSchema: INVISIBLE_DASH_SETTINGS,
};

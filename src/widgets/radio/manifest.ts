import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { RADIO_SETTINGS } from './settings-schema';

export const RADIO_MANIFEST: WidgetManifest = {
  id: 'radio',
  // The transmission rides the always-sent 10 Hz radio frame and the names the
  // session snapshot, so there is no gated field to declare.
  telemetryEvents: [],
  label: 'Radio',
  description:
    'Who is talking on the radio: car number in its class colour, name and channel.',
  // A 4:3 tile: the number tab and the wave across the top half, the mic and
  // the name across the bottom.
  designWidth: 200,
  designHeight: 150,
  lockAspectRatio: true,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: 200,
    currentHeight: 150,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...RADIO_SETTINGS.defaults,
  },
  settingsSchema: RADIO_SETTINGS,
};

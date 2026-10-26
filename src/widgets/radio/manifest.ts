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
  // The number and the channel tabs across the top, the name below them in
  // two lines over the wave.
  designWidth: 180,
  designHeight: 112,
  lockAspectRatio: true,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: 180,
    currentHeight: 112,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...RADIO_SETTINGS.defaults,
  },
  settingsSchema: RADIO_SETTINGS,
};

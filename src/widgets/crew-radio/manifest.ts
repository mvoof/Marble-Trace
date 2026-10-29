import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { CREW_RADIO_SETTINGS } from './settings-schema';

export const CREW_RADIO_MANIFEST: WidgetManifest = {
  id: 'crew-radio',
  // The radio rides the voice crew's own events, not the telemetry bundle.
  telemetryEvents: [],
  label: 'Crew Radio',
  description:
    'The voice engineer on the radio: what you asked, the reply, ✓ or ✗.',
  // A fixed width and as tall as the lines it holds, so the plate paints its
  // own ground and the container hugs it.
  transparentContainer: true,
  contentSized: true,
  designWidth: 320,
  designHeight: 80,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: 320,
    currentHeight: 80,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...CREW_RADIO_SETTINGS.defaults,
  },
  settingsSchema: CREW_RADIO_SETTINGS,
};

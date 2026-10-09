import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { INCIDENT_HUD_SETTINGS } from './settings-schema';

export const INCIDENT_HUD_MANIFEST: WidgetManifest = {
  id: 'incident-hud',
  telemetryEvents: ['safetyRating'],
  previewScenarios: [
    'incident-clean',
    'incident-minor',
    'incident-penalty-warning',
    'incident-dq',
    'incident-unranked',
  ],
  label: 'Incident HUD',
  description:
    'Incidents, penalties and an estimated Safety Rating at the flag.',
  autoHeight: true,
  // The plate follows its content — a session without penalties drops a
  // column — so the widget paints its own background and border on it, and
  // the container stays transparent.
  transparentContainer: true,
  requiredCapabilities: ['standings'],
  designWidth: 180,
  designHeight: 60,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: 180,
    currentHeight: 60,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...INCIDENT_HUD_SETTINGS.defaults,
  },
  settingsSchema: INCIDENT_HUD_SETTINGS,
};

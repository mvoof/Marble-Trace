import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { COACH_SETTINGS } from './settings-schema';

export const COACH_MANIFEST: WidgetManifest = {
  id: 'coach',
  previewScenarios: [
    'driving-coach-brake',
    'driving-coach-brake-soon',
    'driving-coach-gas',
    'driving-coach-grip',
    'driving-coach-inactive',
  ],
  telemetryEvents: ['carDynamics', 'carInputs', 'coach'],
  label: 'Coach',
  description:
    'Brake/gas call and a speed trace against your stored best lap, colored by time gained or lost.',
  requiredCapabilities: ['playerDynamics'],
  designWidth: 300,
  designHeight: 130,
  // The trace can be switched off, leaving only the call row — a fixed height
  // would hang an empty plate under it.
  autoHeight: true,
  userSettings: {
    enabled: false,
    x: 400,
    y: 240,
    currentWidth: 300,
    currentHeight: 130,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...COACH_SETTINGS.defaults,
  },
  settingsSchema: COACH_SETTINGS,
};

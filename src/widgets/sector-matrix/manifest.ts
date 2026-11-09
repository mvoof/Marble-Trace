import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@widgets/widget-manifest';
import { SECTOR_MATRIX_SETTINGS } from './settings-schema';

export const SECTOR_MATRIX_MANIFEST: WidgetManifest = {
  id: 'sector-matrix',
  telemetryEvents: ['lapDelta'],
  label: 'Sector Matrix',
  description:
    'Sector-by-sector timing with progress bar, live delta per sector, LAST and BEST.',
  requiredCapabilities: ['sectors'],
  previewScenarios: ['sector-in-progress'],
  autoHeight: true,
  // The redesign mockup's card.
  designWidth: 330,
  designHeight: 180,
  userSettings: {
    enabled: false,
    x: 100,
    y: 300,
    currentWidth: 330,
    currentHeight: 180,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...SECTOR_MATRIX_SETTINGS.defaults,
  },
  settingsSchema: SECTOR_MATRIX_SETTINGS,
};

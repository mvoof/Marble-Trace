import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const SECTOR_MATRIX_MANIFEST: WidgetManifest = {
  id: 'sector-matrix',
  order: 180,
  telemetryEvents: ['lapDelta'],
  label: 'Sector Matrix',
  description:
    'Sector-by-sector timing with progress bar, live delta per sector, LAST and BEST.',
  requiredCapabilities: ['sectors'],
  autoHeight: true,
  designWidth: 320,
  designHeight: 180,
  userSettings: {
    enabled: false,
    x: 100,
    y: 300,
    currentWidth: 320,
    currentHeight: 180,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showPredicted: true,
    showSectors: true,
  },
};

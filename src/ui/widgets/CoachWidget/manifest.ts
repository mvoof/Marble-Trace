import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const COACH_MANIFEST: WidgetManifest = {
  id: 'coach',
  order: 240,
  telemetryEvents: ['carDynamics', 'carInputs'],
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
    showCallRow: true,
    showTrace: true,
    traceChannel: 'speed',
    windowMeters: 150,
    showUrgencyBar: true,
    showCornerExitCalls: true,
    showSpeed: true,
    showReferenceLapTime: true,
    showTrackCondition: true,
    brakeColor: '#ef4444',
    gasColor: '#10b981',
    referenceColor: '#a855f7',
    gainColor: '#10b981',
    lossColor: '#ef4444',
  },
};

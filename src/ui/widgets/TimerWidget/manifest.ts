import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const TIMER_MANIFEST: WidgetManifest = {
  id: 'timer',
  order: 130,
  telemetryEvents: ['driverEntries'],
  label: 'Timer',
  description: 'Stint and total session timers.',
  autoHeight: true,
  requiredCapabilities: ['playerDynamics'],
  designWidth: 240,
  designHeight: 120,
  userSettings: {
    enabled: false,
    x: 50,
    y: 310,
    currentWidth: 240,
    currentHeight: 120,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showSessionType: true,
    showLaps: true,
    showPosition: true,
    useLivePositions: true,
    classPositionInMulticlass: true,
    showWallClock: true,
    showSimTime: true,
    showPcDate: false,
    showSimDate: true,
  },
};

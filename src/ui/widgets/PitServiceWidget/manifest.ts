import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const PIT_SERVICE_MANIFEST: WidgetManifest = {
  id: 'pit-service',
  label: 'Pit Service',
  description: 'Pit stop order, repairs, tow time and pit lane speed.',
  // The pit order itself needs no chassis telemetry, but the tire grid draws
  // temperatures and wear from it — without them half the widget is blank.
  requiredCapabilities: ['chassis'],
  designWidth: 300,
  designHeight: 540,
  // Blocks are switched on and off individually; a fixed height would leave
  // an empty plate hanging under whatever is still shown.
  autoHeight: true,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: 300,
    currentHeight: 540,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showPitSpeed: true,
    useLivePositions: true,
    classPositionInMulticlass: true,
    showProjectedPosition: true,
    showFuel: true,
    showTires: true,
    showRepairs: true,
    showFooter: false,
    alwaysVisible: false,
    autoFuel: false,
    autoTires: false,
    autoTireWearThreshold: 60,
    fuelAdjustStep: 1,
    commandRevealSeconds: 5,
  },
};

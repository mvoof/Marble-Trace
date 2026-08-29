import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

// The tire grid is what the width has to hold: two corners of three tread
// sections each (ws(26) x 3 + 2 px gaps = 82), 4 px of air around every tread,
// the gap between the corners and the same 4 px at the panel edge. The toggle
// row underneath asks for a little more than that — FAST REP, WINDSHIELD and
// the compound side by side, none of them allowed to wrap — and it is what sets
// the final number.
const BASE_DESIGN_WIDTH = 235;

export const PIT_SERVICE_MANIFEST: WidgetManifest = {
  id: 'pit-service',
  order: 110,
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Pit Service',
  description: 'Pit stop order, repairs, tow time and pit lane speed.',
  // The pit order itself needs no chassis telemetry, but the tire grid draws
  // temperatures and wear from it — without them half the widget is blank.
  requiredCapabilities: ['chassis'],
  designWidth: BASE_DESIGN_WIDTH,
  designHeight: 330,
  // Blocks are switched on and off individually; a fixed height would leave
  // an empty plate hanging under whatever is still shown.
  autoHeight: true,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: BASE_DESIGN_WIDTH,
    currentHeight: 330,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showPitSpeed: true,
    showPitApproach: true,
    pitApproachCueDistM: 100,
    revealOnApproachM: 400,
    showPitBrakeCue: true,
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

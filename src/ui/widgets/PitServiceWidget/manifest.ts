import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

// The tire grid sets the floor — two corners of three number columns each
// (ws(26) x 3 + 2 px gaps = 82) plus their air — but the chip row underneath is
// what sets the number: FAST REP, WINDSHIELD and the compound side by side, none
// of them allowed to wrap. Squeezing the panel down to the digits alone is what
// clipped those words, so the width stays where it was.
const BASE_DESIGN_WIDTH = 235;

// The stack without the speed and approach bars, which left with the Pit Line
// widget. Only a starting point: the widget sizes itself to the blocks that are
// actually switched on.
const PIT_SERVICE_DESIGN_HEIGHT = 280;

export const PIT_SERVICE_MANIFEST: WidgetManifest = {
  id: 'pit-service',
  order: 110,
  previewScenarios: ['pit-service', 'pit-tow'],
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Pit Service',
  description: 'Pit stop order: fuel, tires, repairs and tow time.',
  // The pit order itself needs no chassis telemetry, but the tire grid draws
  // temperatures and wear from it — without them half the widget is blank.
  requiredCapabilities: ['chassis'],
  designWidth: BASE_DESIGN_WIDTH,
  designHeight: PIT_SERVICE_DESIGN_HEIGHT,
  // Blocks are switched on and off individually; a fixed height would leave
  // an empty plate hanging under whatever is still shown.
  autoHeight: true,
  // The width is the sum of the number columns, so it is not a preference and
  // never was: a stored one from an earlier shape of the panel survives as dead
  // space at the right edge of every row. Normalized on load, with
  // `currentWidth` rescaled by the same factor so the driver keeps their scale.
  deriveDesignWidth: () => BASE_DESIGN_WIDTH,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: BASE_DESIGN_WIDTH,
    currentHeight: PIT_SERVICE_DESIGN_HEIGHT,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    revealOnApproachM: 400,
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

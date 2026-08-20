import type {
  PitServiceWidgetSettings,
  WidgetManifest,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  makeColumnLayoutResolver,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

// Panel width without the side rail, and what the rail adds to it — the rail's
// own width plus the gap it sits behind (ws(52) + sp(xs) in the stylesheet).
const BASE_DESIGN_WIDTH = 300;
const SIDE_RAIL_WIDTH = 60;

export const PIT_SERVICE_MANIFEST: WidgetManifest = {
  id: 'pit-service',
  telemetryEvents: ['carDynamics', 'driverEntries'],
  label: 'Pit Service',
  description: 'Pit stop order, repairs, tow time and pit lane speed.',
  // The pit order itself needs no chassis telemetry, but the tire grid draws
  // temperatures and wear from it — without them half the widget is blank.
  requiredCapabilities: ['chassis'],
  designWidth: BASE_DESIGN_WIDTH,
  designHeight: 540,
  // Blocks are switched on and off individually; a fixed height would leave
  // an empty plate hanging under whatever is still shown.
  autoHeight: true,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: BASE_DESIGN_WIDTH,
    currentHeight: 540,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showPitSpeed: true,
    showPitApproach: true,
    pitApproachPlacement: 'inline',
    pitApproachSide: 'right',
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
  // The side rail is a column of its own, so the widget grows by its width
  // instead of squeezing the tire grid; --wfs stays where the driver put it.
  resolveLayoutChange: makeColumnLayoutResolver<PitServiceWidgetSettings>(
    ['showPitApproach', 'pitApproachPlacement'],
    (settings) =>
      BASE_DESIGN_WIDTH +
      (settings.showPitApproach && settings.pitApproachPlacement === 'side'
        ? SIDE_RAIL_WIDTH
        : 0)
  ),
};

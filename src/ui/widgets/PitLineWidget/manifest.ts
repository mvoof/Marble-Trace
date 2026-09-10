import type { WidgetManifest } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

// The width is the shape and the height is the driver's: the columns are only
// as wide as the number at their foot — wide enough for three digits at the size
// they are read at — and they fill whatever height the widget is dragged to.
const DESIGN_WIDTH = 120;
const DESIGN_HEIGHT = 150;

export const PIT_LINE_MANIFEST: WidgetManifest = {
  id: 'pit-line',
  order: 115,
  telemetryEvents: ['carDynamics'],
  label: 'Pit Line',
  description: 'Pit lane speed against the limit, and the roll to your stall.',
  designWidth: DESIGN_WIDTH,
  designHeight: DESIGN_HEIGHT,
  // Deliberately not `autoHeight`: the height *is* the bar — it is what the
  // driver drags to make the gauge taller, and content that sized itself would
  // take that handle away.
  //
  // The width is not a preference either: it is the two columns and their air,
  // so a stored one from an earlier shape is dead space rather than a size
  // anyone chose. `restoreWidgets` rescales `currentWidth` by the same factor,
  // which keeps the scale the driver set.
  deriveDesignWidth: () => DESIGN_WIDTH,
  userSettings: {
    enabled: false,
    x: 100,
    y: 100,
    currentWidth: DESIGN_WIDTH,
    currentHeight: DESIGN_HEIGHT,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    showPitSpeed: true,
    showPitApproach: true,
    showPitBrakeCue: true,
    showUnits: true,
    revealOnApproachM: 300,
    alwaysVisible: false,
  },
};

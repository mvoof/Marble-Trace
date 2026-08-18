import type { WidgetManifest } from '@/types/widget-settings';
import type { ResolveLayoutChange } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
} from '@ui/widgets/widget-manifest';

export const LINEAR_MAP_SIZES: Record<
  string,
  { designWidth: number; designHeight: number }
> = {
  horizontal: { designWidth: 400, designHeight: 40 },
  vertical: { designWidth: 40, designHeight: 400 },
};

// Swaps width<->height when orientation changes (horizontal<->vertical rotation).
// designWidth/Height are taken from LINEAR_MAP_SIZES to match the new orientation's reference size.
const resolveRelativeMapLayout: ResolveLayoutChange = (prev, next, current) => {
  if (!('orientation' in next) || !next.orientation) return null;

  const prevOrientation = 'orientation' in prev ? prev.orientation : undefined;

  if (prevOrientation === next.orientation) return null;

  const size = LINEAR_MAP_SIZES[next.orientation];

  if (!size) return null;

  return {
    designWidth: size.designWidth,
    designHeight: size.designHeight,
    currentWidth: current.currentHeight,
    currentHeight: current.currentWidth,
  };
};

export const RELATIVE_MAP_MANIFEST: WidgetManifest = {
  id: 'relative-map',
  telemetryEvents: ['carPositions', 'relative'],
  label: 'Relative Map',
  description: 'Progress bar of car track positions.',
  resolveLayoutChange: resolveRelativeMapLayout,
  requiredCapabilities: ['relative'],
  designWidth: 400,
  designHeight: 40,
  userSettings: {
    enabled: false,
    x: 50,
    y: 820,
    currentWidth: 400,
    currentHeight: 40,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    orientation: 'horizontal',
    playerDotColor: '#18181b',
    targetDotRadiusPx: 10,
    paceCarUseClassColor: false,
    paceCarColor: '#facc15',
    paceCarRadiusPx: 10,
    paceCarShowInPits: false,
    classShapes: false,
  },
};

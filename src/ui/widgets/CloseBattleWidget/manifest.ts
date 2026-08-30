import type {
  CloseBattleWidgetSettings,
  WidgetManifest,
} from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
  makeColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';
import { computeCloseBattleDesignWidth } from '@ui/widgets/CloseBattleWidget/close-battle-utils';

// Every column on the plate is optional except the number, the name and the
// gap, and the plate spans the widget — so a switched-off column has to take
// the widget's width with it, otherwise the driver gets the same plate with a
// hole in it instead of the short one they asked for.
const resolveCloseBattleLayout =
  makeColumnLayoutResolver<CloseBattleWidgetSettings>(
    ['showClassBadge', 'showBrand', 'showDistance', 'showLapGap', 'nameMode'],
    computeCloseBattleDesignWidth
  );

const CLOSE_BATTLE_COLUMN_DEFAULTS = {
  showClassBadge: true,
  showBrand: false,
  showDistance: true,
  showLapGap: true,
  nameMode: 'initial',
} as const;

const CLOSE_BATTLE_DESIGN_WIDTH = computeCloseBattleDesignWidth(
  CLOSE_BATTLE_COLUMN_DEFAULTS as unknown as CloseBattleWidgetSettings
);

/** White: the line sits on the widget's own background, whatever that is. */
const PLAYER_LINE_DEFAULT_COLOR = '#ffffff';

export const CLOSE_BATTLE_MANIFEST: WidgetManifest = {
  id: 'close-battle',
  order: 40,
  telemetryEvents: ['proximity', 'relative', 'driverEntries'],
  label: 'Close Battle',
  description: 'Who is fighting you right now, on a vertical distance axis.',
  requiredCapabilities: ['radar'],
  resolveLayoutChange: resolveCloseBattleLayout,
  designWidth: CLOSE_BATTLE_DESIGN_WIDTH,
  designHeight: 420,
  overflowVisible: true,
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: CLOSE_BATTLE_DESIGN_WIDTH,
    currentHeight: 420,
    ...COMMON_WIDGET_DEFAULTS,
    ...TRANSPARENT_APPEARANCE_DEFAULTS,
    trigger: 'gap',
    gapThreshold: 2,
    distanceThreshold: 50,
    hideDelay: 3,
    sides: 'both',
    maxRows: 2,
    showTicks: true,
    showTickLabels: true,
    compactMode: false,
    ...CLOSE_BATTLE_COLUMN_DEFAULTS,
    mergeOverlapping: true,
    mergeDistance: 2,
    hideInPits: true,
    qualifyingVisibility: 'auto',
    plateOpacity: 1,
    scaleByDistance: true,
    otherClass: 'dim',
    glowRange: 30,
    showAxis: true,
    showPlayerLine: true,
    playerLineColor: PLAYER_LINE_DEFAULT_COLOR,
    raceOnly: true,
  },
};

import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  TRANSPARENT_APPEARANCE_DEFAULTS,
  makeColumnLayoutResolver,
} from '@widgets/widget-manifest';
import { computeCloseBattleDesignWidth } from './close-battle-utils';
import {
  CLOSE_BATTLE_COLUMN_KEYS,
  CLOSE_BATTLE_SETTINGS,
  type CloseBattleWidgetSettings,
} from './settings-schema';

// Every column on the plate is optional except the number, the name and the
// gap, and the plate spans the widget — so a switched-off column has to take
// the widget's width with it, otherwise the driver gets the same plate with a
// hole in it instead of the short one they asked for.
const resolveCloseBattleLayout =
  makeColumnLayoutResolver<CloseBattleWidgetSettings>(
    CLOSE_BATTLE_COLUMN_KEYS,
    computeCloseBattleDesignWidth
  );

const CLOSE_BATTLE_DESIGN_WIDTH = computeCloseBattleDesignWidth(
  CLOSE_BATTLE_SETTINGS.defaults
);

export const CLOSE_BATTLE_MANIFEST: WidgetManifest = {
  id: 'close-battle',
  previewScenarios: ['close-battle', 'traffic-rear-bumper'],
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
    ...CLOSE_BATTLE_SETTINGS.defaults,
  },
  settingsSchema: CLOSE_BATTLE_SETTINGS,
};

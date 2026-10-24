import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeColumnLayoutResolver,
} from '@widgets/widget-manifest';
import { computeAbsDesignWidth } from './abs-utils';
import { ABS_SETTINGS, type AbsWidgetSettings } from './settings-schema';

// Hiding the level takes its width with it, so the driver gets the badge alone
// rather than the same plate with a hole where the number was.
const resolveAbsLayout = makeColumnLayoutResolver<AbsWidgetSettings>(
  ['showLevel'],
  computeAbsDesignWidth
);

const ABS_DESIGN_WIDTH = computeAbsDesignWidth(ABS_SETTINGS.defaults);

export const ABS_MANIFEST: WidgetManifest = {
  id: 'abs',
  // The level rides the always-sent carStatus frame; the light is carInputs.
  telemetryEvents: ['carInputs'],
  requiredCapabilities: ['playerDynamics'],
  label: 'ABS',
  description:
    'The ABS setting from the cockpit, with a badge that lights while ABS is working.',
  resolveLayoutChange: resolveAbsLayout,
  designWidth: ABS_DESIGN_WIDTH,
  designHeight: 52,
  userSettings: {
    enabled: false,
    x: 700,
    y: 660,
    currentWidth: ABS_DESIGN_WIDTH,
    currentHeight: 52,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...ABS_SETTINGS.defaults,
  },
  settingsSchema: ABS_SETTINGS,
};

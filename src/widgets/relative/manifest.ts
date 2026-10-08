import type { WidgetManifest } from '@shared/contracts/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@widgets/widget-manifest';
import { computeRelativeDesignWidth } from './relative-utils';
import {
  RELATIVE_COLUMN_KEYS,
  RELATIVE_SETTINGS,
  type RelativeWidgetSettings,
} from './settings-schema';

const resolveRelativeLayout =
  makeExactColumnLayoutResolver<RelativeWidgetSettings>(
    // A column's width changes as well as its presence (the license letter,
    // the badge style, the abbreviated iRating), so every one of them
    // re-measures the table exactly as a column being toggled does.
    RELATIVE_COLUMN_KEYS,
    computeRelativeDesignWidth
  );

const RELATIVE_DESIGN_WIDTH = computeRelativeDesignWidth(
  RELATIVE_SETTINGS.defaults
);

export const RELATIVE_MANIFEST: WidgetManifest = {
  id: 'relative',
  previewScenarios: ['field-close-pack'],
  telemetryEvents: ['carPositions', 'relative'],
  label: 'Relative',
  description: 'Gaps to cars ahead and behind you.',
  resolveLayoutChange: resolveRelativeLayout,
  deriveDesignWidth: (settings) =>
    computeRelativeDesignWidth(settings as unknown as RelativeWidgetSettings),
  requiredCapabilities: ['relative'],
  designWidth: RELATIVE_DESIGN_WIDTH,
  designHeight: 400,
  userSettings: {
    enabled: true,
    x: 50,
    y: 300,
    currentWidth: RELATIVE_DESIGN_WIDTH,
    currentHeight: 400,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...RELATIVE_SETTINGS.defaults,
  },
  settingsSchema: RELATIVE_SETTINGS,
};

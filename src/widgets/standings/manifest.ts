import type { WithFontScale } from '@shared/ui/StatChip/rating';
import type { WidgetManifest } from '@shared/contracts/widget-settings';
import { STANDINGS_VIEW_MODE } from '@shared/contracts/widget-choices';
import {
  COMMON_WIDGET_DEFAULTS,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@widgets/widget-manifest';
import { computeStandingsDesignWidth } from './standings-utils';
import {
  STANDINGS_COLUMN_KEYS,
  STANDINGS_SETTINGS,
  type StandingsWidgetSettings,
} from './settings-schema';

const resolveStandingsLayout = makeExactColumnLayoutResolver<
  WithFontScale<StandingsWidgetSettings>
>(
  // Some of these change a column's width rather than its presence (the
  // license letter, the badge style, the abbreviated iRating), so the table
  // is re-measured for them exactly as for a column being toggled. The font
  // scale widens the rating chip, so it re-measures the table too.
  [...STANDINGS_COLUMN_KEYS, 'fontScale'],
  computeStandingsDesignWidth
);

const STANDINGS_DESIGN_WIDTH = computeStandingsDesignWidth(
  STANDINGS_SETTINGS.defaults
);

export const STANDINGS_MANIFEST: WidgetManifest = {
  id: 'standings',
  // The footer under the table carries the weather and the incident counter,
  // so the two states those are sized against belong to this widget as much as
  // to the weather widget itself.
  previewScenarios: [
    'field-close-pack',
    'team-race',
    'incident-limit',
    'rain',
    'heavy-rain',
  ],
  telemetryEvents: ['driverEntries'],
  label: 'Standings',
  description: 'Live session standings and intervals.',
  resolveLayoutChange: resolveStandingsLayout,
  deriveDesignWidth: (settings) =>
    computeStandingsDesignWidth(settings as unknown as StandingsWidgetSettings),
  requiredCapabilities: ['standings'],
  designWidth: STANDINGS_DESIGN_WIDTH,
  designHeight: 500,
  userSettings: {
    enabled: true,
    x: 50,
    y: 50,
    currentWidth: STANDINGS_DESIGN_WIDTH,
    currentHeight: 500,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS,
    ...STANDINGS_SETTINGS.defaults,
  },
  settingsSchema: STANDINGS_SETTINGS,
  hotkeyCycles: [
    {
      action: 'standings:cycle-view-mode',
      setting: 'viewMode',
      values: STANDINGS_VIEW_MODE,
    },
  ],
};

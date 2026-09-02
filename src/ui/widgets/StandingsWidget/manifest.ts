import type { WidgetManifest } from '@/types/widget-settings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  DEFAULT_PLAYER_ACCENT_COLOR,
  DEFAULT_PLAYER_ROW_COLOR,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';
import {
  NAME_COLUMN_DEFAULT_PX,
  computeStandingsDesignWidth,
} from '@ui/widgets/StandingsWidget/standings-utils';

const resolveStandingsLayout =
  makeExactColumnLayoutResolver<StandingsWidgetSettings>(
    [
      'showLicBadge',
      // Both change a column's width rather than its presence, so the table has
      // to be re-measured for them exactly as it is for a column being toggled.
      'showLicenseLetter',
      'abbreviateIRating',
      'showIRating',
      'showIrChange',
      'showLapsCompleted',
      'showPosChange',
      'showCountryFlag',
      'showBrand',
      'showTire',
      'nameColumnWidth',
    ],
    computeStandingsDesignWidth
  );

const STANDINGS_COLUMN_DEFAULTS = {
  nameColumnWidth: NAME_COLUMN_DEFAULT_PX,
  showPosChange: true,
  showCountryFlag: false,
  showBrand: true,
  showTire: true,
  showLicBadge: true,
  showLicenseLetter: true,
  showIRating: true,
  abbreviateIRating: true,
  showIrChange: true,
  showLapsCompleted: true,
};
const STANDINGS_DESIGN_WIDTH = computeStandingsDesignWidth(
  STANDINGS_COLUMN_DEFAULTS as unknown as StandingsWidgetSettings
);

export const STANDINGS_MANIFEST: WidgetManifest = {
  id: 'standings',
  order: 50,
  telemetryEvents: ['driverEntries'],
  label: 'Standings',
  description: 'Live session standings and intervals.',
  resolveLayoutChange: resolveStandingsLayout,
  deriveDesignWidth: (settings) =>
    computeStandingsDesignWidth(settings as StandingsWidgetSettings),
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
    rowPadding: 'narrow',
    viewMode: 'all',
    scrollResetSeconds: 8,
    ...STANDINGS_COLUMN_DEFAULTS,
    showLivePosChange: true,
    useLivePositions: true,
    driversAhead: 0,
    driversBehind: 0,
    groupedRowsPerClass: 0,
    showColumnHeaders: true,
    showSessionHeader: true,
    showSessionTime: true,
    showWeather: true,
    showSOF: true,
    abbreviateSof: true,
    showTotalDrivers: true,
    showPitStops: true,
    showIncidentsBadge: true,
    abbreviateNames: false,
    showDriverFlags: true,
    hideRetiredDrivers: false,
    hideDriversWithoutLap: false,
    dimSecondaryColumns: false,
    playerRowColor: DEFAULT_PLAYER_ROW_COLOR,
    playerAccentColor: DEFAULT_PLAYER_ACCENT_COLOR,
  },
};

import type { WidgetManifest } from '@/types/widget-settings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  DEFAULT_PLAYER_ACCENT_COLOR,
  DEFAULT_PLAYER_ROW_COLOR,
  PANEL_APPEARANCE_DEFAULTS,
  makeExactColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';
import {
  NAME_COLUMN_DEFAULT_PX,
  computeRelativeDesignWidth,
} from '@ui/widgets/RelativeWidget/relative-utils';

const resolveRelativeLayout =
  makeExactColumnLayoutResolver<RelativeWidgetSettings>(
    [
      'showLicBadge',
      // Change a column's width rather than its presence, so the table is
      // re-measured for them exactly as for a column being toggled.
      'showLicenseLetter',
      'abbreviateIRating',
      'showIRating',
      'showCountryFlag',
      'nameColumnWidth',
    ],
    computeRelativeDesignWidth
  );

const RELATIVE_COLUMN_DEFAULTS = {
  nameColumnWidth: NAME_COLUMN_DEFAULT_PX,
  showLicBadge: true,
  showLicenseLetter: true,
  showIRating: true,
  abbreviateIRating: true,
  showCountryFlag: false,
};
const RELATIVE_DESIGN_WIDTH = computeRelativeDesignWidth(
  RELATIVE_COLUMN_DEFAULTS as unknown as RelativeWidgetSettings
);

export const RELATIVE_MANIFEST: WidgetManifest = {
  id: 'relative',
  order: 60,
  telemetryEvents: ['carPositions', 'relative'],
  label: 'Relative',
  description: 'Gaps to cars ahead and behind you.',
  resolveLayoutChange: resolveRelativeLayout,
  deriveDesignWidth: (settings) =>
    computeRelativeDesignWidth(settings as RelativeWidgetSettings),
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
    useLivePositions: true,
    rowPadding: 'narrow',
    ...RELATIVE_COLUMN_DEFAULTS,
    showPitIndicator: true,
    abbreviateNames: true,
    showDriverFlags: true,
    playerRowColor: DEFAULT_PLAYER_ROW_COLOR,
    playerAccentColor: DEFAULT_PLAYER_ACCENT_COLOR,
    paceCarShowInPits: false,
  },
};

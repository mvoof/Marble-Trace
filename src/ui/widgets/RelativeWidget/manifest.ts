import type { WidgetManifest } from '@/types/widget-settings';
import type { RelativeWidgetSettings } from '@/types/widget-settings';
import {
  COMMON_WIDGET_DEFAULTS,
  DEFAULT_PLAYER_ACCENT_COLOR,
  DEFAULT_PLAYER_ROW_COLOR,
  PANEL_APPEARANCE_DEFAULTS,
  makeColumnLayoutResolver,
} from '@ui/widgets/widget-manifest';
import { computeRelativeDesignWidth } from '@ui/widgets/RelativeWidget/relative-utils';

const resolveRelativeLayout = makeColumnLayoutResolver<RelativeWidgetSettings>(
  ['showLicBadge', 'showIRating'],
  computeRelativeDesignWidth
);

const RELATIVE_COLUMN_DEFAULTS = {
  showLicBadge: true,
  showIRating: true,
};
const RELATIVE_DESIGN_WIDTH = computeRelativeDesignWidth(
  RELATIVE_COLUMN_DEFAULTS as unknown as RelativeWidgetSettings
);

export const RELATIVE_MANIFEST: WidgetManifest = {
  id: 'relative',
  label: 'Relative',
  description: 'Gaps to cars ahead and behind you.',
  resolveLayoutChange: resolveRelativeLayout,
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

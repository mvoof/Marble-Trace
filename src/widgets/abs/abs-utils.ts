import type { AbsWidgetSettings } from './settings-schema';

/** The badge alone, square-cut, with the plate's padding around it. */
const BADGE_ONLY_DESIGN_WIDTH = 92;

/** What the level block adds beside the badge: two digits and the slant. */
const LEVEL_DESIGN_WIDTH = 58;

export const computeAbsDesignWidth = (
  settings: Pick<AbsWidgetSettings, 'showLevel'>
): number =>
  BADGE_ONLY_DESIGN_WIDTH + (settings.showLevel ? LEVEL_DESIGN_WIDTH : 0);

import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';
import { TIME_VISIBILITY } from '@shared/contracts/widget-choices';

export const SECTOR_MATRIX_SETTINGS = defineSettings('sectorMatrix', {
  showPredicted: bool(true),
  showSectors: bool(true),
  /** The LAST chip in the footer. */
  lastLapChip: choice(TIME_VISIBILITY, 'always'),
  /** The BEST chip in the footer. */
  bestLapChip: choice(TIME_VISIBILITY, 'always'),
});

export type SectorMatrixWidgetSettings = SettingsOf<
  typeof SECTOR_MATRIX_SETTINGS.shape
>;

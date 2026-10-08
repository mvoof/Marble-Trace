import {
  bool,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const SECTOR_MATRIX_SETTINGS = defineSettings('sectorMatrix', {
  showPredicted: bool(true),
  showSectors: bool(true),
});

export type SectorMatrixWidgetSettings = SettingsOf<
  typeof SECTOR_MATRIX_SETTINGS.shape
>;

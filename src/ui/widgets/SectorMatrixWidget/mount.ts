import type { WidgetMount } from '@ui/widgets/widget-mount';
import { SECTOR_MATRIX_MANIFEST } from './manifest';
import { SectorMatrixWidget } from './SectorMatrixWidget';

export const mount: WidgetMount = {
  id: SECTOR_MATRIX_MANIFEST.id,
  component: SectorMatrixWidget,
};

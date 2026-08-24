import type { WidgetMount } from '@ui/widgets/widget-mount';
import { FUEL_MANIFEST } from './manifest';
import { FuelWidget } from './FuelWidget';

export const mount: WidgetMount = {
  id: FUEL_MANIFEST.id,
  component: FuelWidget,
};

import type { WidgetMount } from '@ui/widgets/widget-mount';
import { DELTA_MANIFEST } from './manifest';
import { DeltaWidget } from './DeltaWidget';

export const mount: WidgetMount = {
  id: DELTA_MANIFEST.id,
  component: DeltaWidget,
};

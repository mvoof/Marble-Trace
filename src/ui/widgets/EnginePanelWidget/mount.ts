import type { WidgetMount } from '@ui/widgets/widget-mount';
import { ENGINE_PANEL_MANIFEST } from './manifest';
import { EnginePanelWidget } from './EnginePanelWidget';

export const mount: WidgetMount = {
  id: ENGINE_PANEL_MANIFEST.id,
  component: EnginePanelWidget,
};

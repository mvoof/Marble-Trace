import type { WidgetMount } from '@widgets/widget-mount';
import { ENGINE_PANEL_MANIFEST } from './manifest';
import { EnginePanelWidget } from './EnginePanelWidget';
import { EnginePanelWidgetStore } from './engine-panel.store';

export const mount: WidgetMount = {
  id: ENGINE_PANEL_MANIFEST.id,
  component: EnginePanelWidget,
  store: (context) => new EnginePanelWidgetStore(context),
};

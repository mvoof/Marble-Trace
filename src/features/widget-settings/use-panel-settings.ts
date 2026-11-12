import type { BaseUserSettings } from '@shared/contracts/widget-settings';
import { useWidgetEditor } from './WidgetEditorContext';
import { usePanelWidgetId } from './setting-rows';

/**
 * The settings of the widget a panel edits, and a writer that merges a partial
 * into them. `fallbackId` is the widget type, used where no panel context
 * exists (see `usePanelWidgetId`).
 */
export const usePanelSettings = <Settings extends object>(
  fallbackId: string
): [
  settings: BaseUserSettings & Settings,
  update: (partial: Partial<Settings>) => void,
] => {
  const editor = useWidgetEditor();
  const widgetId = usePanelWidgetId(fallbackId);

  const settings = editor.getSettings<Settings>(widgetId);

  const update = (partial: Partial<Settings>) => {
    editor.updateUserSettings(widgetId, { ...settings, ...partial });
  };

  return [settings, update];
};

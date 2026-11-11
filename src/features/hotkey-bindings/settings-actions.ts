import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';
import { WIDGETS } from '@entities/widget/widget-catalog';

import { visibilityActionWidget } from './actions';

interface SettingsActionDeps {
  appSettings: AppSettingsStore;
  liveWidgets: LiveWidgetsStore;
}

/**
 * The settings actions, applied here because the main window owns the settings
 * they write. The backend catches the key, checks the layout gate and sends
 * the id; nothing else about an action lives in the frontend.
 */
const SETTINGS_ACTIONS: Record<string, (root: SettingsActionDeps) => void> = {
  'app:toggle-hide-all-widgets': (root) =>
    root.appSettings.toggleHideAllWidgets(),
  // A widget's setting cycles, declared in its manifest.
  ...Object.fromEntries(
    WIDGETS.flatMap((manifest) =>
      (manifest.hotkeyCycles ?? []).map((cycle) => [
        cycle.action,
        (root: SettingsActionDeps) =>
          root.liveWidgets.cycleSetting(
            manifest.id,
            cycle.setting,
            cycle.values
          ),
      ])
    )
  ),
};

export const applySettingsAction = (
  root: SettingsActionDeps,
  actionId: string
) => {
  const widgetId = visibilityActionWidget(actionId);

  if (widgetId !== null) {
    // The instances marked for the hotkeys, together — a browser screen
    // included unless it was unmarked.
    root.liveWidgets.toggleVisibilityByHotkey(widgetId);

    return;
  }

  const apply = SETTINGS_ACTIONS[actionId];

  if (!apply) {
    console.warn(`[bindings] no settings action "${actionId}"`);

    return;
  }

  apply(root);
};

/** Whether every settings action the backend declares has a handler here. */
export const hasSettingsHandler = (actionId: string): boolean =>
  actionId in SETTINGS_ACTIONS;

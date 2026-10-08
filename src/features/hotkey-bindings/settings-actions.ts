import type { MainRoot } from '@app/roots/main-root';
import { visibilityActionWidget } from './actions';

/**
 * The settings actions, applied here because the main window owns the settings
 * they write. The backend catches the key, checks the layout gate and sends
 * the id; nothing else about an action lives in the frontend.
 */
const SETTINGS_ACTIONS: Record<string, (root: MainRoot) => void> = {
  'app:toggle-hide-all-widgets': (root) =>
    root.appSettings.toggleHideAllWidgets(),
  'standings:cycle-view-mode': (root) =>
    root.liveWidgets.cycleStandingsViewMode(),
  'delta:cycle-reference': (root) => root.liveWidgets.cycleDeltaReference(),
};

export const applySettingsAction = (root: MainRoot, actionId: string) => {
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

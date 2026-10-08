import { comparer, reaction, type IReactionDisposer } from 'mobx';

import { listenTo, type UnlistenFn } from '@shared/api/events.service';
import {
  setHotkeyBindings,
  setHotkeyContext,
} from '@shared/api/hotkeys.service';
import { applySettingsAction } from '@features/hotkey-bindings/settings-actions';
import type { MainRoot } from '@store/roots/main-root';
import type { HotkeySettingsAction } from '@shared/contracts/bindings';
import { HOTKEY_SETTINGS_ACTION_EVENT } from './sim-events';

const reportFailure = (what: string) => (error: unknown) =>
  console.error(`[bindings] ${what} failed`, error);

/**
 * The main window's half of the hotkeys. The dispatcher runs in the backend
 * (`src-tauri/src/hotkeys/`); main tells it what is bound and what the layout
 * gate reads, and applies the settings actions it hands back — the settings
 * are main's to write.
 *
 * Registered after hydration, so the first map pushed is the user's: until it
 * arrives the backend has nothing registered, rather than the shipped defaults
 * over keys the user may have cleared.
 */
export const registerHotkeyReactions = (
  root: MainRoot
): IReactionDisposer[] => [
  // The effective map, not the overrides: the backend has no registry of
  // defaults to layer them over.
  reaction(
    () => root.bindings.mutationId,
    () => {
      setHotkeyBindings(root.bindings.bindings).catch(
        reportFailure('pushing the bindings')
      );
    },
    { fireImmediately: true }
  ),
  reaction(
    () => ({
      widgetsOnScreen: root.liveWidgets.onScreenWidgetTypes,
      interactHotkeyMode: root.appSettings.appSettings.interactHotkeyMode,
      interactAutoOffSeconds:
        root.appSettings.appSettings.interactAutoOffSeconds,
    }),
    (context) => {
      setHotkeyContext(context).catch(reportFailure('pushing the context'));
    },
    { equals: comparer.structural, fireImmediately: true }
  ),
];

export const listenSettingsActions = (root: MainRoot): Promise<UnlistenFn> =>
  listenTo<HotkeySettingsAction>(HOTKEY_SETTINGS_ACTION_EVENT, (event) => {
    try {
      applySettingsAction(root, event.payload.actionId);
    } catch (error) {
      console.error(
        `[bindings] action "${event.payload.actionId}" failed`,
        error
      );
    }
  });

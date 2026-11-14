import { compareStructural, reaction, type IReactionDisposer } from 'mobx';

import type { MainRoot } from '@app/roots/main-root';

/** Edits come in bursts — a drag, a slider — and the file is written once per burst. */
export const SAVE_DEBOUNCE_MS = 500;

/**
 * Everything `buildSettings` writes, as values a reaction compares: a counter
 * where a store keeps one for its writes (the widgets, the layouts, the
 * bindings, the companion list), the value itself where it is small. The app
 * settings are read whole, so a field added to them is saved with no line
 * here — the class of bug this replaces, where a field nobody listed was only
 * written when the window closed.
 */
export const savedSettingsSignal = (root: MainRoot): unknown[] => [
  root.settingsMutations.changeToken,
  root.widgetDefaults.changeToken,
  root.bindings.mutationId,
  root.companionApps.revision,
  JSON.stringify(root.appSettings.appSettings),
  root.units.unitSystem,
  root.layouts.liveLayoutId,
  JSON.stringify(root.layouts.autoSwitchRules),
  JSON.stringify(root.deviceInput.knownDevices),
];

/**
 * The one save trigger. Requires hydrated stores: registered any earlier, it
 * would write the defaults over the user's file.
 */
export const registerSaveReaction = (
  root: MainRoot,
  onSave: () => Promise<void>
): IReactionDisposer =>
  reaction(
    () => savedSettingsSignal(root),
    () => {
      void onSave();
    },
    { delay: SAVE_DEBOUNCE_MS, equals: compareStructural }
  );

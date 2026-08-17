import { reaction } from 'mobx';

import { hydrateFromDisk, readSettingsFile } from './persistence-sync';
import {
  emitDragMode,
  emitWidgetSettingsToMain,
} from '@platform/services/events.service';
import { publishRemoteControl } from '@platform/services/remote.service';
import { setupOverlayListeners } from './listeners';
import { registerPitServiceMirrorReactions } from './pit-service-sync';
import type { RootStore } from '@store/root-store';

/**
 * Everything an overlay window owns. It never writes the settings file — the
 * main window is the only writer — and it never opens chat connections.
 *
 * Order is load-bearing: the listeners are subscribed before this returns, so
 * the window is ready for the first `widget-settings-updated` main emits.
 */
export const initOverlaySync = async (root: RootStore) => {
  const { loaded } = await readSettingsFile();

  // The main window owns the backup — both windows run the chain, but only one
  // of them may touch the file.
  await hydrateFromDisk(root, loaded, { backup: false });

  // Locked: the widget map still holds the shipped defaults, so loading the
  // active layout here would paint a default overlay across the user's screen —
  // indistinguishable from having lost their config. OverlayCanvas draws
  // nothing while the lock holds.
  if (root.appSettings.settingsLocked) {
    return () => {};
  }

  // hydrateStores fills the live widget map from the persisted snapshot, which
  // can lag behind the active layout. The window renders the layout, so it is
  // the layout that has to win.
  root.widgetSettings.loadActiveLayoutWidgets();

  const unlistens = await setupOverlayListeners(root);

  const disposers = [
    reaction(
      () => root.appSettings.dragMode,
      (v) => {
        void emitDragMode(v);
      }
    ),
    reaction(
      () => root.widgetSettings.changeToken,
      () => {
        const monitorName = root.widgetSettings.ownMonitorName;

        if (!monitorName) return;

        void emitWidgetSettingsToMain({
          monitorName,
          widgets: root.widgetSettings.allWidgets,
        });
      },
      { delay: 100 }
    ),
    // A rotation restored from disk is never emitted — nobody turned anything,
    // the window simply loaded the angle it had. The remote screens have no
    // settings file of their own, so an overlay is what tells them.
    reaction(
      () => ({
        trackId: root.trackMapWidget.currentTrackId,
        rotation: root.trackMapWidget.trackRotation,
      }),
      ({ trackId, rotation }) => {
        if (!trackId) return;

        void publishRemoteControl('track-rotation', {
          trackId,
          rotation,
        }).catch((error: unknown) =>
          console.error('[overlay-sync] failed to publish rotation:', error)
        );
      },
      { fireImmediately: true }
    ),
    // Clicks on the checkboxes land here, so this window can be the one that
    // takes the order, or one half of it, off auto.
    ...registerPitServiceMirrorReactions(root),
  ];

  return () => {
    unlistens.forEach((u) => u());
    disposers.forEach((d) => d());
  };
};

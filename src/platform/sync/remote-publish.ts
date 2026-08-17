import { reaction, runInAction } from 'mobx';

import { listenRemoteDevice } from '@platform/services/events.service';
import {
  publishRemoteSnapshot,
  startRemoteServer,
  stopRemoteServer,
} from '@platform/services/remote.service';
import { resolveAppLanguage } from '@store/settings/app-settings.store';
import { widgetsOnMonitor } from '@store/settings/virtual-desktop';
import { isRemoteMonitor } from '@utils/remote-screen';
import type { RootStore } from '@store/root-store';
import type { RemoteScreenSnapshot } from '@/types/remote';
import type { RemoteDevice } from '@/types/bindings';

/**
 * Main-window half of the remote screens: it owns the server's lifetime and
 * feeds it one snapshot per remote screen.
 *
 * Deliberately one-way. The browsers never talk back, so nothing here listens
 * for anything — a device on the network cannot reach the settings file.
 */

/** Enough to coalesce a drag in the layout editor into one publish. */
const PUBLISH_DEBOUNCE_MS = 150;

const snapshotFor = (
  root: RootStore,
  slug: string
): RemoteScreenSnapshot | null => {
  const layout = root.layouts.activeLayout;

  if (!layout) return null;

  const monitor = layout.monitors.find(
    (candidate) => isRemoteMonitor(candidate) && candidate.slug === slug
  );

  if (!monitor) return null;

  return {
    slug,
    name: monitor.name,
    bounds: { ...monitor.bounds },
    // The widgets of this screen only: a tablet never receives the layout of
    // the monitors it is not showing.
    widgets: widgetsOnMonitor(
      root.widgetSettings.allWidgets,
      monitor.name,
      layout.monitors
    ),
    units: root.units.unitSystem,
    language: root.appSettings.appSettings.language,
    steeringLock: root.appSettings.appSettings.steeringLock,
    layoutName: layout.name,
  };
};

const publishAll = (root: RootStore) => {
  for (const monitor of root.layouts.activeRemoteScreens) {
    const slug = monitor.slug;

    if (!slug) continue;

    const snapshot = snapshotFor(root, slug);

    if (!snapshot) continue;

    void publishRemoteSnapshot(slug, snapshot).catch((error: unknown) =>
      console.error('[remote-publish] failed to publish snapshot:', error)
    );
  }
};

/**
 * Matches a screen to the device that just opened it — once.
 *
 * The size chosen when creating a screen is a guess from a preset list, so the
 * first device to report in gets to correct it. Every report after that is only
 * offered in settings: a second device with a different screen, or an address
 * bar sliding in and out, must not silently reshape a layout that has already
 * been built. Resizing the browser window needs no help either — the page
 * scales the whole layout to whatever viewport it has.
 */
const fitScreenOnFirstConnect = (root: RootStore, device: RemoteDevice) => {
  // A backgrounded tab can report a real width with a zero height; fitting to
  // that would flatten the screen, and the one-shot flag means nothing repairs
  // it later.
  if (
    !device.connected ||
    device.viewportWidth <= 0 ||
    device.viewportHeight <= 0
  ) {
    return;
  }

  const monitor = root.layouts.activeRemoteScreens.find(
    (screen) => screen.slug === device.slug
  );

  if (!monitor || monitor.fittedToDevice) return;

  runInAction(() => {
    monitor.fittedToDevice = true;
  });

  root.widgetSettings.resizeRemoteScreen(
    monitor.name,
    device.viewportWidth,
    device.viewportHeight
  );
};

export const registerRemotePublishing = (root: RootStore) => {
  const applyServerState = async () => {
    const settings = root.appSettings.appSettings;

    if (!settings.remoteEnabled) {
      await stopRemoteServer().catch((error: unknown) =>
        console.error('[remote-publish] failed to stop server:', error)
      );

      // A stopped server has no clients, and the devices it knew about are not
      // connected to anything any more.
      runInAction(() => root.remoteDevices.reset());

      return;
    }

    try {
      await startRemoteServer({
        port: settings.remotePort,
        lan: settings.remoteLan,
        token: settings.remoteToken,
        telemetryHz: settings.remoteTelemetryHz,
        // Resolved here rather than in the backend: 'system' means the user's
        // OS locale, and the frontend is what knows how that resolved.
        language: resolveAppLanguage(settings.language),
      });

      // The server starts with an empty cache, so a device that reconnects
      // before the next layout edit still gets its screen.
      publishAll(root);
    } catch (error) {
      console.error('[remote-publish] failed to start server:', error);
    }
  };

  const deviceUnlisten = listenRemoteDevice((device) => {
    runInAction(() => root.remoteDevices.upsert(device));
    fitScreenOnFirstConnect(root, device);
  });

  const disposers = [
    reaction(
      () => {
        const settings = root.appSettings.appSettings;

        return [
          settings.remoteEnabled,
          settings.remotePort,
          settings.remoteLan,
          settings.remoteToken,
          settings.remoteTelemetryHz,
          settings.language,
        ] as const;
      },
      () => void applyServerState(),
      { fireImmediately: true, equals: (a, b) => a.every((v, i) => v === b[i]) }
    ),

    // `changeToken` moves on every widget settings change, and the active
    // layout id on every switch — a remote screen follows the session the same
    // way a monitor does.
    reaction(
      () => [
        root.widgetSettings.changeToken,
        root.layouts.activeLayoutId,
        root.units.unitSystem,
        root.appSettings.appSettings.steeringLock,
      ],
      () => {
        if (!root.appSettings.appSettings.remoteEnabled) return;

        publishAll(root);
      },
      { delay: PUBLISH_DEBOUNCE_MS }
    ),
  ];

  return () => {
    void deviceUnlisten.then((unlisten) => unlisten());
    disposers.forEach((dispose) => dispose());
  };
};

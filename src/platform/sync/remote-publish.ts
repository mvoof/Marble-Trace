import { reaction, runInAction } from 'mobx';

import { listenRemoteDevice } from '@platform/services/events.service';
import {
  publishRemoteSnapshot,
  startRemoteServer,
  stopRemoteServer,
} from '@platform/services/remote.service';
import { resolveAppLanguage } from '@store/settings/app-settings.store';
import { widgetsOnMonitor } from '@store/settings/virtual-desktop';
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
  const target = root.layouts.remoteScreenBySlug(slug);

  if (!target) return null;

  const { layout, screen: monitor } = target;
  const isLive = layout.id === root.layouts.liveLayoutId;
  const widgets = isLive
    ? widgetsOnMonitor(
        root.liveWidgets.liveWidgets,
        monitor.name,
        layout.monitors
      )
    : widgetsOnMonitor(layout.widgets, monitor.name, layout.monitors);

  return {
    slug,
    name: monitor.name,
    bounds: { ...monitor.bounds },
    // The widgets of this screen only: a tablet never receives the layout of
    // the monitors it is not showing.
    widgets,
    units: root.units.unitSystem,
    language: root.appSettings.appSettings.language,
    steeringLock: root.appSettings.appSettings.steeringLock,
    layoutName: layout.name,
    background: monitor.background,
  };
};

const publishAll = (root: RootStore) => {
  const seenSlugs = new Set<string>();

  for (const descriptor of root.layouts.allRemoteScreens) {
    const slug = descriptor.screen.slug;

    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

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

  const target = root.layouts.remoteScreenBySlug(device.slug);

  if (!target || target.screen.fittedToDevice) return;

  runInAction(() => {
    target.screen.fittedToDevice = true;
  });

  root.layouts.resizeRemoteScreen(
    target.screen.name,
    device.viewportWidth,
    device.viewportHeight,
    target.layout.id
  );
};

export const registerRemotePublishing = (root: RootStore) => {
  const applyServerState = async () => {
    const settings = root.appSettings.appSettings;

    if (!settings.remoteEnabled) {
      runInAction(() => root.remoteDevices.setServerError(''));

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

      runInAction(() => root.remoteDevices.setServerError(''));

      // The server starts with an empty cache, so a device that reconnects
      // before the next layout edit still gets its screen.
      publishAll(root);
    } catch (error) {
      // Shown in settings, not only logged: the usual cause is a port another
      // program holds, and there is nothing about "not running" that tells the
      // user to go and change the port.
      runInAction(() =>
        root.remoteDevices.setServerError(
          error instanceof Error ? error.message : String(error)
        )
      );
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
          root.remoteDevices.restartToken,
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
        root.settingsMutations.changeToken,
        root.layouts.liveLayoutId,
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

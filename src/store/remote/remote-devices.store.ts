import { makeAutoObservable, runInAction } from 'mobx';

import { getRemoteServerInfo } from '@shared/api/remote.service';
import type {
  RemoteDevice,
  RemoteServerInfo,
} from '@shared/contracts/bindings';

/** How often the remote-screens page asks the server how it is. */
const SERVER_INFO_POLL_MS = 3000;

/**
 * What the devices showing remote screens report about themselves, keyed by
 * screen slug.
 *
 * Main window only — the overlays never see a device. Entries survive a
 * disconnect with `connected` cleared, so the settings UI can still show the
 * size a tablet had when it was last on.
 */
export class RemoteDevicesStore {
  devices = new Map<string, RemoteDevice>();

  /**
   * Why the server is not running, when it was asked to be — a taken port,
   * most often. Empty while it is up or switched off.
   *
   * Kept here rather than logged: "not running" with no reason is a dead end
   * for the user, since nothing retries on its own once the settings that
   * drive the server have stopped changing.
   */
  serverError = '';

  /** Bumped by the retry button; the publisher restarts the server on it. */
  restartToken = 0;

  /** The server's address and status, while the remote-screens page watches it. */
  serverInfo: RemoteServerInfo | null = null;

  private serverInfoTimer: ReturnType<typeof setInterval> | null = null;

  /** Bumped on every stop, so a reply that arrives after it is dropped. */
  private serverInfoGeneration = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Polls the server's status until the returned function is called. */
  watchServerInfo(): () => void {
    this.stopWatchingServerInfo();

    const generation = this.serverInfoGeneration;
    const poll = () => {
      getRemoteServerInfo()
        .then((info) => this.acceptServerInfo(generation, info))
        .catch(() => this.acceptServerInfo(generation, null));
    };

    poll();
    this.serverInfoTimer = setInterval(poll, SERVER_INFO_POLL_MS);

    return () => this.stopWatchingServerInfo();
  }

  stopWatchingServerInfo() {
    if (this.serverInfoTimer !== null) {
      clearInterval(this.serverInfoTimer);
      this.serverInfoTimer = null;
    }

    this.serverInfoGeneration++;
    this.serverInfo = null;
  }

  private acceptServerInfo(generation: number, info: RemoteServerInfo | null) {
    if (generation !== this.serverInfoGeneration) {
      return;
    }

    runInAction(() => {
      this.serverInfo = info;
    });
  }

  upsert(device: RemoteDevice) {
    this.devices.set(device.slug, device);
  }

  setServerError(message: string) {
    this.serverError = message;
  }

  requestRestart() {
    this.serverError = '';
    this.restartToken++;
  }

  bySlug(slug: string): RemoteDevice | undefined {
    return this.devices.get(slug);
  }

  /** A server that stopped forgets its clients; so does this. */
  reset() {
    this.devices.clear();
  }
}

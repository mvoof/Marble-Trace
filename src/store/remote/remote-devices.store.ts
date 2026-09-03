import { makeAutoObservable } from 'mobx';

import type { RemoteDevice } from '@/types/bindings';

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

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
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

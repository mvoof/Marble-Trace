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

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  upsert(device: RemoteDevice) {
    this.devices.set(device.slug, device);
  }

  bySlug(slug: string): RemoteDevice | undefined {
    return this.devices.get(slug);
  }

  /** A server that stopped forgets its clients; so does this. */
  reset() {
    this.devices.clear();
  }
}

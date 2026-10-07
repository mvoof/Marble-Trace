import { createStoreContext } from '@shared/lib/store-context';
import type { RemoteDevicesStore } from './remote-devices.store';

export const [RemoteDevicesContext, useRemoteDevicesStore] =
  createStoreContext<RemoteDevicesStore>('RemoteDevicesStore');

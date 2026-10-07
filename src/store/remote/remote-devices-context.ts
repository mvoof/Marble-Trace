import { createStoreContext } from '@utils/store-context';
import type { RemoteDevicesStore } from './remote-devices.store';

export const [RemoteDevicesContext, useRemoteDevicesStore] =
  createStoreContext<RemoteDevicesStore>('RemoteDevicesStore');

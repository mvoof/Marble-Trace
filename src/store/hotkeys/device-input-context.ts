import { createStoreContext } from '@utils/store-context';
import type { DeviceInputStore } from './device-input.store';

export const [DeviceInputContext, useDeviceInputStore] =
  createStoreContext<DeviceInputStore>('DeviceInputStore');

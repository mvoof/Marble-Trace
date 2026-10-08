import { createStoreContext } from '@shared/lib/store-context';
import type { DeviceInputStore } from './device-input.store';

export const [DeviceInputContext, useDeviceInputStore] =
  createStoreContext<DeviceInputStore>('DeviceInputStore');

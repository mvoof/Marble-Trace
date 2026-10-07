import { createStoreContext } from '@utils/store-context';
import type { FlagsStore } from './flags.store';

export const [FlagsContext, useFlagsStore] =
  createStoreContext<FlagsStore>('FlagsStore');

import { createStoreContext } from '@shared/lib/store-context';
import type { FlagsStore } from './flags.store';

export const [FlagsContext, useFlagsStore] =
  createStoreContext<FlagsStore>('FlagsStore');

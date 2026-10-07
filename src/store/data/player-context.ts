import { createStoreContext } from '@shared/lib/store-context';
import type { PlayerStore } from './player.store';

export const [PlayerContext, usePlayerStore] =
  createStoreContext<PlayerStore>('PlayerStore');

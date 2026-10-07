import { createStoreContext } from '@utils/store-context';
import type { PlayerStore } from './player.store';

export const [PlayerContext, usePlayerStore] =
  createStoreContext<PlayerStore>('PlayerStore');

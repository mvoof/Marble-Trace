import { createStoreContext } from '@utils/store-context';
import type { PlayerPositionStore } from './player-position.store';

export const [PlayerPositionContext, usePlayerPositionStore] =
  createStoreContext<PlayerPositionStore>('PlayerPositionStore');

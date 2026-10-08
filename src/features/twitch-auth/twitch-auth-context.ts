import { createStoreContext } from '@shared/lib/store-context';
import type { TwitchAuthStore } from './twitch-auth.store';

export const [TwitchAuthContext, useTwitchAuthStore] =
  createStoreContext<TwitchAuthStore>('TwitchAuthStore');

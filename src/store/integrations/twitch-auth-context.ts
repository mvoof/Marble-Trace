import { createStoreContext } from '@utils/store-context';
import type { TwitchAuthStore } from './twitch-auth.store';

export const [TwitchAuthContext, useTwitchAuthStore] =
  createStoreContext<TwitchAuthStore>('TwitchAuthStore');

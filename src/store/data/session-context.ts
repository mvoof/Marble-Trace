import { createStoreContext } from '@utils/store-context';
import type { SessionStore } from './session.store';

export const [SessionContext, useSessionStore] =
  createStoreContext<SessionStore>('SessionStore');

import { createStoreContext } from '@shared/lib/store-context';
import type { SessionStore } from './session.store';

export const [SessionContext, useSessionStore] =
  createStoreContext<SessionStore>('SessionStore');

import { createStoreContext } from '@shared/lib/store-context';
import type { ChatStore } from './chat.store';

export const [ChatContext, useChatStore] =
  createStoreContext<ChatStore>('ChatStore');

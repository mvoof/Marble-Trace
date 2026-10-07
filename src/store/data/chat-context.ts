import { createStoreContext } from '@utils/store-context';
import type { ChatStore } from './chat.store';

export const [ChatContext, useChatStore] =
  createStoreContext<ChatStore>('ChatStore');

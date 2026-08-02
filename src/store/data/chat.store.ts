import { makeAutoObservable, runInAction } from 'mobx';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type {
  ChatDeletion,
  ChatMessage,
  ChatPlatform,
  ChatPresence,
} from '@/types/bindings';
import {
  CHAT_DELETION,
  CHAT_MESSAGE,
  CHAT_PRESENCE,
} from '@store/sync/sim-events';

// Hard ceiling on retained messages. The widget shows far fewer; this only
// bounds memory on a channel that never stops talking.
const MESSAGE_BUFFER_LIMIT = 300;

export class ChatStore {
  messages: ChatMessage[] = [];
  presence = new Map<ChatPlatform, ChatPresence>();

  private unlisteners: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable<ChatStore, 'unlisteners'>(
      this,
      { unlisteners: false },
      { autoBind: true }
    );
  }

  async init() {
    const message = await listen<ChatMessage>(CHAT_MESSAGE, (event) => {
      runInAction(() => this.appendMessage(event.payload));
    });

    const presence = await listen<ChatPresence>(CHAT_PRESENCE, (event) => {
      runInAction(() => this.updatePresence(event.payload));
    });

    const deletion = await listen<ChatDeletion>(CHAT_DELETION, (event) => {
      runInAction(() => this.applyDeletion(event.payload));
    });

    this.unlisteners.push(message, presence, deletion);
  }

  appendMessage(message: ChatMessage) {
    this.messages.push(message);

    if (this.messages.length > MESSAGE_BUFFER_LIMIT) {
      this.messages.splice(0, this.messages.length - MESSAGE_BUFFER_LIMIT);
    }
  }

  /**
   * Presence arrives piecemeal — the IRC loop reports status while the Helix
   * poll reports viewers. Merging instead of replacing keeps a status-only
   * update from wiping the last known viewer count.
   */
  updatePresence(next: ChatPresence) {
    const previous = this.presence.get(next.platform);

    this.presence.set(next.platform, {
      ...next,
      viewers: next.viewers ?? previous?.viewers ?? null,
      uptimeSeconds: next.uptimeSeconds ?? previous?.uptimeSeconds ?? null,
      roomMode: next.roomMode ?? previous?.roomMode ?? null,
    });
  }

  applyDeletion(deletion: ChatDeletion) {
    this.messages = this.messages.filter((message) => {
      if (message.platform !== deletion.platform) {
        return true;
      }

      if (deletion.messageId && message.id === deletion.messageId) {
        return false;
      }

      // Twitch reports a ban by login name while messages carry the display
      // name — same account, different casing, so compare case-insensitively.
      if (
        deletion.authorName &&
        message.authorName.toLowerCase() === deletion.authorName.toLowerCase()
      ) {
        return false;
      }

      return true;
    });
  }

  reset() {
    this.messages = [];
    this.presence.clear();
  }

  dispose() {
    this.unlisteners.forEach((unlisten) => unlisten());
    this.unlisteners = [];
  }
}

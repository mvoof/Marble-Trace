import { comparer, reaction, type IReactionDisposer } from 'mobx';

import {
  startChatStreamSilent,
  stopChatStreamSilent,
} from '@platform/services/twitch.service';
import {
  emitStreamChatCleared,
  emitStreamChatFilters,
} from '@platform/services/events.service';
import type { RootStore } from '@store/root-store';

const STREAM_CHAT_WIDGET_ID = 'stream-chat';

/**
 * Stream-chat connectors. MAIN window only — overlays just listen to the
 * resulting `chat://` events.
 *
 * Requires a hydrated settings store: the connect reaction is `fireImmediately`
 * and would otherwise open (or refuse to open) sockets based on the shipped
 * defaults rather than the user's channel.
 */
export const registerChatReactions = (
  root: RootStore,
  onSave: () => Promise<void>
): IReactionDisposer[] => [
  // Restarting on any source change keeps a single code path for "connect" and
  // "reconnect with new settings".
  reaction(
    () => ({
      // A disabled widget means nobody is reading chat, so the sockets and the
      // Helix polling should not be running either. The widgets page renders
      // its preview against a seeded store, so it never needs a live
      // connection.
      // Asked of the layout on screen, not the one in the editor: opening a
      // layout without the chat widget must not tear down the connectors the
      // driver is reading from.
      enabled: root.liveWidgets.liveWidgets.some(
        (widget) =>
          widget.id === STREAM_CHAT_WIDGET_ID && widget.userSettings.enabled
      ),
      config: {
        twitchChannel: root.appSettings.appSettings.streamChatTwitchChannel,
        youtubeTarget: root.appSettings.appSettings.streamChatYoutubeTarget,
        twitchClientId: root.appSettings.appSettings.streamChatTwitchClientId,
        // Tokens stay in the OS credential store; this only signals that the
        // signed-in state changed and the connectors should restart.
        authRevision: root.appSettings.appSettings.streamChatAuthRevision,
      },
    }),
    ({ enabled, config }) => {
      const hasTarget = Boolean(
        config.twitchChannel?.trim() || config.youtubeTarget?.trim()
      );

      if (enabled && hasTarget) {
        startChatStreamSilent(config);
      } else {
        // Nothing to read, or nothing to read it with: tear the connectors down
        // and drop the buffer so re-enabling starts on live messages instead of
        // a stale backlog.
        stopChatStreamSilent();
        root.chat.reset();
        void emitStreamChatCleared();
      }

      void onSave();
    },
    { equals: comparer.structural, fireImmediately: true, delay: 400 }
  ),
  reaction(
    () => ({
      hideCommands: root.appSettings.appSettings.streamChatHideCommands,
      ignoredBots: root.appSettings.appSettings.streamChatIgnoredBots,
    }),
    (filters) => {
      void emitStreamChatFilters(filters);
      void onSave();
    },
    { equals: comparer.structural }
  ),
];

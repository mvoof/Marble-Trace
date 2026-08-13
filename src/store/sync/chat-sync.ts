import { comparer, reaction, type IReactionDisposer } from 'mobx';

import {
  startChatStreamSilent,
  stopChatStreamSilent,
} from '@platform/services/twitch.service';
import {
  emitStreamChatCleared,
  emitStreamChatFilters,
} from '@platform/services/events.service';
import type { RootStore } from '../root-store';

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
      enabled:
        root.widgetSettings.getWidget(STREAM_CHAT_WIDGET_ID)?.userSettings
          .enabled === true,
      // Previewing another layout in the editor swaps the working copy while
      // the overlay still draws the active one — the connectors follow the
      // overlay, not the preview.
      editorPreviewMode: root.widgetSettings.editorPreviewMode,
      config: {
        twitchChannel: root.appSettings.appSettings.streamChatTwitchChannel,
        youtubeTarget: root.appSettings.appSettings.streamChatYoutubeTarget,
        twitchClientId: root.appSettings.appSettings.streamChatTwitchClientId,
        // Tokens stay in the OS credential store; this only signals that the
        // signed-in state changed and the connectors should restart.
        authRevision: root.appSettings.appSettings.streamChatAuthRevision,
      },
    }),
    ({ enabled, editorPreviewMode, config }) => {
      // The flag is part of the tracked value, so leaving preview mode re-runs
      // this with the real active layout.
      if (editorPreviewMode) {
        return;
      }

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

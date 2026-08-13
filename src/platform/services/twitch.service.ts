import { invoke } from '@tauri-apps/api/core';

import type { TwitchDeviceCode, TwitchTokenResult } from '@/types/bindings';

// Not in bindings.ts: the backend command takes this shape as a plain
// serde struct that specta does not export.
export interface ChatStreamConfig {
  twitchChannel: string;
  youtubeTarget: string;
  twitchClientId: string;
  authRevision: number;
}

export const twitchHasClientId = async (): Promise<boolean> =>
  invoke('twitch_has_client_id');

export const twitchCurrentLogin = async (
  clientId: string | null
): Promise<string | null> => invoke('twitch_current_login', { clientId });

export const twitchRequestDeviceCode = async (
  clientId: string | null
): Promise<TwitchDeviceCode> =>
  invoke('twitch_request_device_code', { clientId });

export const twitchPollDeviceToken = async (
  clientId: string | null,
  deviceCode: string
): Promise<TwitchTokenResult> =>
  invoke('twitch_poll_device_token', { clientId, deviceCode });

export const twitchSignOut = async (): Promise<void> =>
  invoke('twitch_sign_out');

/** Fire-and-forget: the chat reaction never awaits the connectors. */
export const startChatStreamSilent = (config: ChatStreamConfig): void => {
  invoke('start_chat_stream', { config }).catch((error) =>
    console.error('[twitch.service] start_chat_stream failed:', error)
  );
};

export const stopChatStreamSilent = (): void => {
  invoke('stop_chat_stream').catch((error) =>
    console.error('[twitch.service] stop_chat_stream failed:', error)
  );
};

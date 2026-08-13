import { invoke } from '@tauri-apps/api/core';

import type { SessionSnapshot } from '@/types/bindings';

export const startTelemetryStream = async (): Promise<void> =>
  invoke('start_telemetry_stream');

export const stopTelemetryStream = async (): Promise<void> =>
  invoke('stop_telemetry_stream');

export const getConnectionStatus = async (): Promise<boolean> =>
  invoke('get_connection_status');

export const getLastSessionInfo = async (): Promise<SessionSnapshot | null> =>
  invoke('get_last_session_info');

/** Fire-and-forget: callers never await the event mask, so log here. */
export const setActiveEventsSilent = (mask: number): void => {
  invoke('set_active_events', { mask }).catch((error) =>
    console.error('[telemetry.service] set_active_events failed:', error)
  );
};

import { invoke } from '@tauri-apps/api/core';

import type { SessionSnapshot, SourceFrame } from '@/types/bindings';

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

/**
 * Opens and closes the telemetry inspector's feed.
 *
 * The inspector pulls rather than subscribing: the settings window was
 * deliberately unsubscribed from the telemetry bundle, and an inspector that
 * listened for it would hand that cost straight back. While this is off the
 * backend keeps no frame at all.
 */
export const setInspectorActive = async (active: boolean): Promise<void> =>
  invoke('set_inspector_active', { active });

/**
 * The last frame the sim adapter produced, refreshed at 4 Hz while the feed is
 * open. `null` while the sim is disconnected or the feed was only just opened.
 */
export const getInspectorFrame = async (): Promise<SourceFrame | null> =>
  invoke('get_inspector_frame');

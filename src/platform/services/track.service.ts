import { invoke } from '@tauri-apps/api/core';

import type {
  ReferenceLapData,
  TrackCondition,
  TrackShapePayload,
} from '@/types/bindings';

export const getCachedTrackShape =
  async (): Promise<TrackShapePayload | null> =>
    invoke('get_cached_track_shape');

export const deleteTrackShape = async (trackId: number): Promise<void> =>
  invoke('delete_track_shape', { trackId });

export const resetPitLanePct = async (trackId: number): Promise<void> =>
  invoke('reset_pit_lane_pct', { trackId });

export const getReferenceLap = async (
  trackId: number,
  carScreenName: string,
  condition: TrackCondition
): Promise<ReferenceLapData | null> =>
  invoke('get_reference_lap', { trackId, carScreenName, condition });

export const deleteReferenceLap = async (
  trackId: number,
  carScreenName: string
): Promise<void> => invoke('delete_reference_lap', { trackId, carScreenName });

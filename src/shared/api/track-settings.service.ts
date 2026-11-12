import { invoke } from '@tauri-apps/api/core';

/**
 * `track-settings.json`: the angle each recorded track's map is turned to.
 *
 * Main is the only window that writes it (`TrackRotationStore`); an overlay
 * reads it once per track change, for the angle main has not sent it yet.
 */

interface StoredTrackData {
  rotation?: number;
}

type StoredTracks = Record<string, StoredTrackData>;

export type TrackRotations = Record<string, number>;

export const readTrackRotations = async (): Promise<TrackRotations> => {
  const tracks =
    (await invoke<StoredTracks | null>('read_track_rotations')) ?? {};
  const rotations: TrackRotations = {};

  for (const [trackId, data] of Object.entries(tracks)) {
    if (data.rotation != null) {
      rotations[trackId] = data.rotation;
    }
  }

  return rotations;
};

/** Replaces the whole file: the caller holds every angle there is. */
export const writeTrackRotations = async (
  rotations: TrackRotations
): Promise<void> => {
  const tracks: StoredTracks = {};

  for (const [trackId, rotation] of Object.entries(rotations)) {
    tracks[trackId] = { rotation };
  }

  await invoke('write_track_rotations', { tracks });
};

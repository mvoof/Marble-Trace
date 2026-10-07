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

const TRACKS_STORE_KEY = 'recorded-tracks';
const TRACK_SETTINGS_STORE = 'track-settings.json';

// Imported lazily so windows that never touch the track map do not load the
// store plugin.
const openTrackSettings = async () => {
  const { load } = await import('@tauri-apps/plugin-store');

  return load(TRACK_SETTINGS_STORE);
};

export const readTrackRotations = async (): Promise<TrackRotations> => {
  const store = await openTrackSettings();
  const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
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
  const store = await openTrackSettings();
  const tracks: StoredTracks = {};

  for (const [trackId, rotation] of Object.entries(rotations)) {
    tracks[trackId] = { rotation };
  }

  await store.set(TRACKS_STORE_KEY, tracks);
  await store.save();
};

import { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

import { TrackMapView, type TrackData } from '../TrackMapView/TrackMapView';
import type { StoredTracks } from '../types';
import { TRACKS_STORE_KEY } from '../types';
import { TRACK_SETTINGS_STORE } from '../track-store';
import {
  useSessionStore,
  useTrackMapWidgetStore,
} from '@store/root-store-context';
import { TRACK_MAP_CLEAR } from '@store/sync/sim-events';

export const TrackMapContent = observer(() => {
  const sessionData = useSessionStore();
  const trackMapWidget = useTrackMapWidgetStore();

  const { sessionInfo } = sessionData;

  const trackId =
    sessionInfo && sessionInfo.trackId >= 0 ? String(sessionInfo.trackId) : '';

  useEffect(() => {
    if (!trackId) return;

    const trackChanged = trackMapWidget.currentTrackId !== trackId;

    if (trackChanged) {
      trackMapWidget.clearTrackShape();
    }

    const loadRotation = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load(TRACK_SETTINGS_STORE);
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        const saved = tracks[trackId];

        if (saved?.rotation != null) {
          trackMapWidget.setTrackRotation(saved.rotation);
        }
      } catch {
        // ignore
      }
    };

    void loadRotation();
  }, [trackId, trackMapWidget]);

  const saveRotation = useCallback(
    async (newRotation: number) => {
      if (!trackId) return;

      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load(TRACK_SETTINGS_STORE);
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

        tracks[trackId] = { rotation: newRotation };

        await store.set(TRACKS_STORE_KEY, tracks);
        await store.save();
      } catch {
        // Silently fail
      }
    },
    [trackId]
  );

  const handleClearTrack = useCallback(async () => {
    if (!trackId) return;

    trackMapWidget.clearTrackShape();

    await Promise.allSettled([
      invoke('delete_track_shape', { trackId: Number(trackId) }),
      (async () => {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load(TRACK_SETTINGS_STORE);
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        delete tracks[trackId];
        await store.set(TRACKS_STORE_KEY, tracks);
        await store.save();
      })(),
    ]);
  }, [trackId, trackMapWidget]);

  useEffect(() => {
    const unlisten = listen(TRACK_MAP_CLEAR, () => {
      void handleClearTrack();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [handleClearTrack]);

  const handleRotate = useCallback(
    (direction: 'cw' | 'ccw') => {
      if (!trackId || !trackMapWidget.trackShape) return;

      const currentRotation = trackMapWidget.trackRotation;
      let newRotation = currentRotation + (direction === 'cw' ? 90 : -90);
      newRotation = (newRotation + 360) % 360;

      trackMapWidget.setTrackRotation(newRotation);

      void saveRotation(newRotation);
    },
    [trackId, trackMapWidget, saveRotation]
  );

  const trackData: TrackData | null = trackMapWidget.trackShape
    ? {
        svgPath: trackMapWidget.trackShape.svgPath,
        viewBox: trackMapWidget.trackShape.viewBox,
        points: trackMapWidget.trackShape.points,
        rotation: trackMapWidget.trackRotation,
      }
    : null;

  return (
    <TrackMapView
      trackData={trackData}
      isRecording={trackMapWidget.isRecording}
      isWaitingForSF={trackMapWidget.isWaitingForSF}
      recordingProgress={trackMapWidget.recordingProgress}
      onRotate={handleRotate}
    />
  );
});

import { useCallback, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

import { TrackMapView, type TrackData } from '../TrackMapView/TrackMapView';
import type { StoredTracks } from '../types';
import { TRACKS_STORE_KEY } from '../types';
import {
  useSessionStore,
  useTrackMapWidgetStore,
} from '@store/root-store-context';

export const TrackMapContent = observer(() => {
  const sessionData = useSessionStore();
  const trackMapWidget = useTrackMapWidgetStore();

  const { sessionInfo } = sessionData;

  const trackId =
    sessionInfo && sessionInfo.trackId >= 0 ? String(sessionInfo.trackId) : '';

  const trackDataRef = useRef<TrackData | null>(null);

  const savedRotationRef = useRef<number>(0);

  const buildTrackData = useCallback(
    (
      shape: {
        svgPath: string;
        viewBox: string;
        points: Array<{ x: number; y: number; pct: number }>;
      },
      rotation: number
    ): TrackData => ({
      svgPath: shape.svgPath,
      viewBox: shape.viewBox,
      points: shape.points,
      rotation,
    }),
    []
  );

  const saveRotation = useCallback(
    async (newRotation: number) => {
      if (!trackId) return;

      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
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

  useEffect(() => {
    if (!trackId) return;

    const trackChanged = trackMapWidget.currentTrackId !== trackId;

    if (trackChanged) {
      savedRotationRef.current = 0;
      trackMapWidget.clearTrackShape();
    }

    const loadRotation = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        const saved = tracks[trackId];

        if (saved?.rotation != null) {
          savedRotationRef.current = saved.rotation;
        }
      } catch {
        // ignore
      }
    };

    void loadRotation();
  }, [trackId, trackMapWidget]);

  useEffect(() => {
    if (!trackMapWidget.trackShape) {
      trackDataRef.current = null;

      return;
    }

    const data = buildTrackData(
      trackMapWidget.trackShape,
      savedRotationRef.current
    );
    trackDataRef.current = data;
  }, [trackMapWidget.trackShape, buildTrackData]);

  const handleClearTrack = useCallback(async () => {
    if (!trackId) return;

    trackMapWidget.clearTrackShape();
    trackDataRef.current = null;

    await Promise.allSettled([
      invoke('delete_track_shape', { trackId: Number(trackId) }),
      (async () => {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        delete tracks[trackId];
        await store.set(TRACKS_STORE_KEY, tracks);
        await store.save();
      })(),
    ]);
  }, [trackId, trackMapWidget]);

  useEffect(() => {
    const unlisten = listen('track-map:clear', () => {
      void handleClearTrack();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [handleClearTrack]);

  const handleRotate = useCallback(
    (direction: 'cw' | 'ccw') => {
      void (async () => {
        const currentData = trackDataRef.current;

        if (!trackId || !currentData) {
          return;
        }

        const currentRotation = currentData.rotation ?? 0;
        let newRotation = currentRotation + (direction === 'cw' ? 90 : -90);
        newRotation = (newRotation + 360) % 360;

        savedRotationRef.current = newRotation;

        if (trackMapWidget.trackShape) {
          trackDataRef.current = buildTrackData(
            trackMapWidget.trackShape,
            newRotation
          );
        }

        await saveRotation(newRotation);
      })();
    },
    [trackId, trackMapWidget, buildTrackData, saveRotation]
  );

  const trackData = trackMapWidget.trackShape
    ? buildTrackData(trackMapWidget.trackShape, savedRotationRef.current)
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

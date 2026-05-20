import { useCallback, useEffect, useReducer, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { listen } from '@tauri-apps/api/event';

import { telemetryStore } from '../../store/iracing/telemetry.store';
import { computedStore } from '../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import type { TrackPoint } from '../../types';

import { TrackRecorderBridge } from './TrackRecorderBridge/TrackRecorderBridge';
import type { RecordingOverlayHandle } from './RecordingOverlay/RecordingOverlay';
import { TrackMapView, type TrackData } from './TrackMapView/TrackMapView';
import type { CarOnTrack, StoredTracks } from './types';
import { TRACKS_STORE_KEY, TRACK_DATA_VERSION } from './types';

type RecordingState = {
  isRecording: boolean;
  isWaitingForSF: boolean;
  recordingProgress: number;
  trackData: TrackData | null;
};

type RecordingAction =
  | { type: 'SET_TRACK_DATA'; data: TrackData | null }
  | { type: 'START_WAITING' }
  | { type: 'START_RECORDING' }
  | { type: 'SET_PROGRESS'; progress: number }
  | { type: 'CLEAR' };

const recordingReducer = (
  state: RecordingState,
  action: RecordingAction
): RecordingState => {
  switch (action.type) {
    case 'SET_TRACK_DATA':
      return {
        ...state,
        trackData: action.data,
        isRecording: false,
        isWaitingForSF: false,
      };
    case 'START_WAITING':
      return { ...state, isWaitingForSF: true, recordingProgress: 0 };
    case 'START_RECORDING':
      return { ...state, isRecording: true, isWaitingForSF: false };
    case 'SET_PROGRESS':
      return { ...state, recordingProgress: action.progress };
    case 'CLEAR':
      return {
        isRecording: false,
        isWaitingForSF: false,
        recordingProgress: 0,
        trackData: null,
      };
    default:
      return state;
  }
};

export const TrackMapWidget = observer(() => {
  const { weekendInfo, sessionInfo } = telemetryStore;
  const settings = widgetSettingsStore.getTrackMapSettings();

  const trackId = weekendInfo?.TrackID?.toString() ?? '';
  const trackName = weekendInfo?.TrackDisplayName ?? '';
  const trackConfig = weekendInfo?.TrackConfigName ?? '';

  const hasSavedRef = useRef(false);

  const [recState, dispatch] = useReducer(recordingReducer, {
    isRecording: false,
    isWaitingForSF: false,
    recordingProgress: 0,
    trackData: null,
  });

  const { isRecording, isWaitingForSF, recordingProgress, trackData } =
    recState;

  const recordingOverlayRef = useRef<RecordingOverlayHandle>(null);

  const setTrackData = useCallback((data: TrackData | null) => {
    dispatch({ type: 'SET_TRACK_DATA', data });
  }, []);

  const setIsRecording = useCallback((nextIsRecording: boolean) => {
    if (nextIsRecording) {
      dispatch({ type: 'START_RECORDING' });
    } else {
      dispatch({ type: 'SET_TRACK_DATA', data: null });
    }
  }, []);

  const setIsWaitingForSF = useCallback((isWaiting: boolean) => {
    if (isWaiting) {
      dispatch({ type: 'START_WAITING' });
    }
  }, []);

  const setRecordingProgress = useCallback((progress: number) => {
    dispatch({ type: 'SET_PROGRESS', progress });
  }, []);

  useEffect(() => {
    if (!trackId) return;

    hasSavedRef.current = false;

    const loadTrack = async () => {
      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};
        const saved = tracks[trackId];

        if (
          saved &&
          saved.svgPath &&
          saved.points?.length > 0 &&
          (saved.version ?? 0) >= TRACK_DATA_VERSION
        ) {
          dispatch({
            type: 'SET_TRACK_DATA',
            data: {
              svgPath: saved.svgPath,
              viewBox: saved.viewBox,
              points: saved.points,
            },
          });
        } else {
          dispatch({ type: 'SET_TRACK_DATA', data: null });
        }
      } catch {
        dispatch({ type: 'SET_TRACK_DATA', data: null });
      }
    };

    void loadTrack();
  }, [trackId]);

  const saveTrack = useCallback(
    async (svgPath: string, viewBox: string, points: TrackPoint[]) => {
      if (!trackId) return;

      try {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('tracks.json');
        const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

        tracks[trackId] = {
          trackName,
          trackConfig,
          svgPath,
          viewBox,
          points,
          recordedAt: new Date().toISOString(),
          version: TRACK_DATA_VERSION,
        };

        await store.set(TRACKS_STORE_KEY, tracks);
        await store.save();
      } catch {
        // Silently fail — track will need re-recording
      }
    },
    [trackId, trackName, trackConfig]
  );

  const clearCurrentTrack = useCallback(async () => {
    if (!trackId) return;
    try {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('tracks.json');
      const tracks = (await store.get<StoredTracks>(TRACKS_STORE_KEY)) ?? {};

      delete tracks[trackId];

      await store.set(TRACKS_STORE_KEY, tracks);
      await store.save();

      dispatch({ type: 'CLEAR' });
    } catch {
      // Silently fail
    }
  }, [trackId]);

  useEffect(() => {
    const unlisten = listen('track-map:clear', () => {
      void clearCurrentTrack();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [clearCurrentTrack]);

  const standings = computedStore.standings;
  const driverEntries = standings?.entries ?? [];
  const carPositions = telemetryStore.carPositions;

  const cars: CarOnTrack[] = driverEntries.map((entry) => ({
    carIdx: entry.carIdx,
    carNumber: entry.carNumber,
    carClassColor: entry.carClassColor,
    carClassId: entry.carClassId,
    lapDistPct:
      carPositions?.car_idx_lap_dist_pct[entry.carIdx] ?? entry.lapDistPct,
    trackSurface:
      carPositions?.car_idx_track_surface[entry.carIdx] ?? entry.trackSurface,
    isPlayer: entry.isPlayer,
    position: entry.position,
    classPosition: entry.classPosition,
  }));

  return (
    <>
      {!trackData && (
        <TrackRecorderBridge
          trackId={trackId}
          onTrackReady={setTrackData}
          onIsRecordingChange={setIsRecording}
          onWaitingForSFChange={setIsWaitingForSF}
          onProgressChange={setRecordingProgress}
          onSaveTrack={saveTrack}
          recordingOverlayRef={recordingOverlayRef}
        />
      )}

      <TrackMapView
        cars={cars}
        trackData={trackData}
        trackName={trackName}
        isRecording={isRecording}
        isWaitingForSF={isWaitingForSF}
        recordingProgress={recordingProgress}
        isForceStartPending={widgetSettingsStore.isTrackMapForceStartPending}
        recordingOverlayRef={recordingOverlayRef}
        settings={settings}
        sectors={sessionInfo?.SplitTimeInfo?.Sectors}
      />
    </>
  );
});

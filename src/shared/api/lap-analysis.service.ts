import { invoke } from '@tauri-apps/api/core';

import type {
  AnalysisLoad,
  AnalysisSet,
  CarSetupView,
  LapRef,
  SessionLaps,
} from '@shared/contracts/generated/bindings';

/** A session's laps for the session modal; `null` when it is not read. */
export const getSessionLaps = (key: string) =>
  invoke<SessionLaps | null>('get_session_laps', { key });

export const getAnalysisSet = () => invoke<AnalysisSet>('get_analysis_set');

/** Laps of another session than the set's replace it. */
export const addAnalysisLaps = (key: string, laps: LapRef[]) =>
  invoke<AnalysisSet>('add_analysis_laps', { key, laps });

/** Drops a session from the database; its files are ignored or deleted. */
export const deleteSession = (key: string, deleteFiles: boolean) =>
  invoke<AnalysisSet>('delete_session', { key, deleteFiles });

export const removeAnalysisLap = (lap: LapRef) =>
  invoke<AnalysisSet>('remove_analysis_lap', { lap });

export const setAnalysisLapColor = (lap: LapRef, color: string) =>
  invoke<AnalysisSet>('set_analysis_lap_color', { lap, color });

export const setAnalysisLapVisible = (lap: LapRef, visible: boolean) =>
  invoke<AnalysisSet>('set_analysis_lap_visible', { lap, visible });

export const setAnalysisReference = (lap: LapRef) =>
  invoke<AnalysisSet>('set_analysis_reference', { lap });

/** Holds exactly `laps` in memory; answers when the loader is done. */
export const loadAnalysisLaps = (laps: LapRef[]) =>
  invoke<AnalysisLoad>('load_analysis_laps', { laps });

/** Drops the analysis telemetry. */
export const unloadAnalysis = () => invoke<void>('unload_analysis');

const POINTS_HEADER_BYTES = 4;

/** `channels` of `laps` on the grid: `values[lap][channel]`, a value a metre. */
export interface LapChannelData {
  points: number;
  values: Float32Array[][];
}

/** Raw bytes, not JSON: the point count, then per lap, per channel, f32s. */
export const getLapChannels = async (
  laps: LapRef[],
  channels: string[]
): Promise<LapChannelData> => {
  const buffer = await invoke<ArrayBuffer>('get_lap_channels', {
    laps,
    channels,
  });
  const points = new DataView(buffer).getUint32(0, true);
  const values = laps.map((_, lapIndex) =>
    channels.map(
      (__, channelIndex) =>
        new Float32Array(
          buffer,
          POINTS_HEADER_BYTES +
            (lapIndex * channels.length + channelIndex) *
              points *
              Float32Array.BYTES_PER_ELEMENT,
          points
        )
    )
  );

  return { points, values };
};

/** The setup the file at `path` wrote; `fileDeleted` once it is gone. */
export const getCarSetup = (path: string) =>
  invoke<CarSetupView>('get_car_setup', { path });

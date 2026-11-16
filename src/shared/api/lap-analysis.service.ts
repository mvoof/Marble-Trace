import { invoke } from '@tauri-apps/api/core';

import type {
  AnalysisSet,
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

export const removeAnalysisLap = (lap: LapRef) =>
  invoke<AnalysisSet>('remove_analysis_lap', { lap });

export const setAnalysisLapColor = (lap: LapRef, color: string) =>
  invoke<AnalysisSet>('set_analysis_lap_color', { lap, color });

export const setAnalysisLapVisible = (lap: LapRef, visible: boolean) =>
  invoke<AnalysisSet>('set_analysis_lap_visible', { lap, visible });

export const setAnalysisReference = (lap: LapRef) =>
  invoke<AnalysisSet>('set_analysis_reference', { lap });

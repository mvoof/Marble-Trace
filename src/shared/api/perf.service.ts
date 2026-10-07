import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import type {
  OverlayPerfReport,
  PerfRunConfig,
} from '@shared/contracts/bindings';

/**
 * The perf run this app was started for, or `null`. The commands exist only in
 * a `dev` backend, so a release build answers with an error — which means the
 * same thing: no run.
 */
export const getPerfRun = async (): Promise<PerfRunConfig | null> =>
  invoke<PerfRunConfig | null>('get_perf_run').catch(() => null);

export const submitOverlayPerf = async (
  report: OverlayPerfReport
): Promise<void> => invoke('submit_overlay_perf', { report });

export const currentWindowLabel = (): string => getCurrentWebviewWindow().label;

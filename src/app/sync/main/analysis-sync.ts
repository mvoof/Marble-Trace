import { compareStructural, reaction, type IReactionDisposer } from 'mobx';
import { getCurrentWindow } from '@tauri-apps/api/window';

import type { MainRoot } from '@app/roots/main-root';

type AnalysisRoot = Pick<MainRoot, 'lapAnalysis' | 'sim' | 'appSettings'>;

/**
 * The lap analysis' telemetry follows its lap set and the game rule: the
 * game running, the main window away and the setting off drop it; focus
 * back loads it again.
 */
export const registerAnalysisSync = async (
  root: AnalysisRoot
): Promise<() => void> => {
  const mainWindow = getCurrentWindow();
  const unlistenFocus = await mainWindow.onFocusChanged(
    ({ payload: focused }) => {
      root.lapAnalysis.setGate({
        ...root.lapAnalysis.gate,
        windowFocused: focused,
      });
    }
  );
  const disposers: IReactionDisposer[] = [
    reaction(
      () => ({
        simConnected: root.sim.isConnected,
        keepWhileGameRuns:
          root.appSettings.appSettings.analysisKeepWhileGameRuns,
      }),
      (inputs) =>
        root.lapAnalysis.setGate({ ...root.lapAnalysis.gate, ...inputs }),
      { fireImmediately: true, equals: compareStructural }
    ),
    reaction(
      () => ({
        holds: root.lapAnalysis.holdsTelemetry,
        laps: root.lapAnalysis.laps.map(
          (lap) => `${lap.lap.path}|${lap.lap.sessionNum}|${lap.lap.lapNum}`
        ),
      }),
      () => void root.lapAnalysis.syncTelemetry(),
      { fireImmediately: true, equals: compareStructural }
    ),
  ];

  root.lapAnalysis.setGate({
    ...root.lapAnalysis.gate,
    windowFocused: await mainWindow.isFocused(),
  });

  return () => {
    unlistenFocus();
    disposers.forEach((dispose) => dispose());
  };
};

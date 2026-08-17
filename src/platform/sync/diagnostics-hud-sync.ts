import { runInAction } from 'mobx';

import { listenTo } from '@platform/services/events.service';
import { DIAGNOSTICS_HUD_STATE_EVENT } from '@platform/services/diagnostics-hud.service';
import type { DiagnosticsHudState } from '@/types/diagnostics';
import type { RootStore } from '@store/root-store';

/**
 * Everything the banner window owns: one listener. It never reads settings and
 * never writes anything back — the run belongs to the main window.
 */
export const initDiagnosticsHudSync = async (root: RootStore) => {
  const unlisten = await listenTo<DiagnosticsHudState>(
    DIAGNOSTICS_HUD_STATE_EVENT,
    (event) => {
      runInAction(() => root.diagnosticsHud.applyState(event.payload));
    }
  );

  return unlisten;
};

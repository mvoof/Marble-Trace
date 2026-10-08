import { runInAction } from 'mobx';

import { listenTo } from '@shared/api/events.service';
import { DIAGNOSTICS_HUD_STATE_EVENT } from '@shared/api/diagnostics-hud.service';
import type { DiagnosticsHudState } from '@shared/contracts/diagnostics';
import type { HudRoot } from '@app/roots/hud-root';

/**
 * Everything the banner window owns: one listener. It never reads settings and
 * never writes anything back — the run belongs to the main window.
 */
export const initDiagnosticsHudSync = async (root: HudRoot) => {
  const unlisten = await listenTo<DiagnosticsHudState>(
    DIAGNOSTICS_HUD_STATE_EVENT,
    (event) => {
      runInAction(() => root.diagnosticsHud.applyState(event.payload));
    }
  );

  return unlisten;
};

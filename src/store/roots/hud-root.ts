import { DiagnosticsHudStore } from '../diagnostics/diagnostics-hud.store';

/**
 * The in-game diagnostics banner window. It renders one banner from one event
 * and reads neither telemetry nor settings, so it holds no renderer core at
 * all.
 */
export class HudRoot {
  diagnosticsHud = new DiagnosticsHudStore();
}

import { HudRoot } from './store/hud-root';
import { HudRootContext } from './store/hud-root-context';
import { DiagnosticsHudWindow } from './ui/app/diagnostics/DiagnosticsHudWindow';
import { renderWindow } from './render-window';

renderWindow(
  <HudRootContext.Provider value={new HudRoot()}>
    <DiagnosticsHudWindow />
  </HudRootContext.Provider>
);

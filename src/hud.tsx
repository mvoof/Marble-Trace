import { HudRoot } from './store/roots/hud-root';
import { HudRootContext } from './store/roots/hud-root-context';
import { DiagnosticsHudWindow } from './ui/app/diagnostics/DiagnosticsHudWindow';
import { renderWindow } from './render-window';

renderWindow(
  <HudRootContext.Provider value={new HudRoot()}>
    <DiagnosticsHudWindow />
  </HudRootContext.Provider>
);

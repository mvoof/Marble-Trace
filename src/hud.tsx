import { HudRoot } from '@app/roots/hud-root';
import { HudRootContext } from '@app/roots/hud-root-context';
import { DiagnosticsHudWindow } from '@app/windows/hud/DiagnosticsHudWindow';
import { renderWindow } from './render-window';

renderWindow(
  <HudRootContext.Provider value={new HudRoot()}>
    <DiagnosticsHudWindow />
  </HudRootContext.Provider>
);

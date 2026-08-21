import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { primaryMonitor } from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { emit } from '@tauri-apps/api/event';

import type { DiagnosticsHudState } from '@/types/diagnostics';

export const DIAGNOSTICS_HUD_LABEL = 'diagnostics-hud';
export const DIAGNOSTICS_HUD_STATE_EVENT = 'diagnostics-hud-state';

const HUD_WIDTH = 420;
const HUD_HEIGHT = 96;
const HUD_TOP_MARGIN = 24;

/**
 * A window of its own rather than a banner drawn on the overlay.
 *
 * The ladder contains a step with no overlay window at all, so a banner living
 * on the overlay would vanish exactly when the user most needs to know the run
 * is still going — and, worse, would add its cost to some steps and not others,
 * quietly biasing every comparison. A separate window is identical in every
 * step and therefore cancels out.
 */
export const openDiagnosticsHud = async (): Promise<void> => {
  const existing = await WebviewWindow.getByLabel(DIAGNOSTICS_HUD_LABEL);

  if (existing) {
    return;
  }

  const hud = new WebviewWindow(DIAGNOSTICS_HUD_LABEL, {
    url: 'index.html#/diagnostics-hud',
    title: 'Marble Trace Diagnostics',
    width: HUD_WIDTH,
    height: HUD_HEIGHT,
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    shadow: false,
    focus: false,
  });

  await new Promise<void>((resolve) => {
    void hud.once('tauri://created', () => resolve());
    void hud.once('tauri://error', () => resolve());
  });

  // Top centre of the primary screen, in physical pixels: the creation options
  // are logical, and a scaled monitor would land the banner off centre.
  const monitor = await primaryMonitor();

  if (monitor) {
    const scale = monitor.scaleFactor || 1;
    const centeredX =
      monitor.position.x + (monitor.size.width - HUD_WIDTH * scale) / 2;

    await hud.setPosition(
      new PhysicalPosition(
        Math.round(centeredX),
        Math.round(monitor.position.y + HUD_TOP_MARGIN * scale)
      )
    );
  }

  // The sim must keep focus for its frame rate to stay representative, and a
  // banner that swallowed clicks would trap the user mid-run.
  await hud.setIgnoreCursorEvents(true);
};

export const closeDiagnosticsHud = async (): Promise<void> => {
  const hud = await WebviewWindow.getByLabel(DIAGNOSTICS_HUD_LABEL);

  await hud?.close();
};

export const emitDiagnosticsHudState = (state: DiagnosticsHudState) =>
  emit(DIAGNOSTICS_HUD_STATE_EVENT, state);

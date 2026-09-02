import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runInAction, type IReactionDisposer } from 'mobx';

import { RootStore } from '@store/root-store';

// The reaction only reads the sim and writes the active layout; everything it
// would emit crosses the Tauri boundary, which is not what is under test.
vi.mock('@platform/services/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

vi.mock('@platform/services/settings.service', () => ({
  setFuelAvgWindowSilent: vi.fn(),
  setPitWarningLapsSilent: vi.fn(),
  setActiveEventsSilent: vi.fn(),
}));

const { registerLayoutAutoSwitchReaction } = await import('./main-sync');

const MONITOR = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const layout = (id: string) => ({
  id,
  name: id,
  createdAt: 0,
  monitors: [MONITOR],
  widgets: [],
});

describe('session layout auto-switch', () => {
  let root: RootStore;
  let dispose: IReactionDisposer;

  const goOnTrackInPractice = () => {
    runInAction(() => {
      root.sim.isConnected = true;
      root.player.carStatus = {
        is_on_track: true,
      } as unknown as typeof root.player.carStatus;
      root.session.sessionInfo = {
        currentSessionNum: 0,
        sessions: [{ sessionType: 'Practice' }],
      } as unknown as typeof root.session.sessionInfo;
    });
  };

  beforeEach(() => {
    root = new RootStore({ skipInit: true });

    root.widgetSettings.setLayouts(
      [layout('layout-garage'), layout('layout-practice')],
      'layout-garage'
    );
    root.widgetSettings.setSessionLayouts({
      Practice: 'layout-practice',
      Garage: 'layout-garage',
    });

    runInAction(() => {
      root.appSettings.appSettings.autoSwitchLayouts = true;
    });

    dispose = registerLayoutAutoSwitchReaction(root);
  });

  afterEach(() => {
    dispose();
    root.dispose();
  });

  it('switches to the session layout when the driver goes on track', () => {
    goOnTrackInPractice();

    expect(root.layouts.activeLayoutId).toBe('layout-practice');
  });

  // Fixed twice before: going on track used to pull the layout out from under
  // whoever was editing it, losing their place mid-edit.
  it('stands down while the layout editor is open', () => {
    root.widgetSettings.setLayoutEditorOpen(true);

    goOnTrackInPractice();

    expect(root.layouts.activeLayoutId).toBe('layout-garage');
  });

  // Standing down is only half of it: the session change that happened while
  // the editor was open must be applied once it closes, or the layout stays
  // wrong until the next session change that nobody may make.
  it('applies the session change that was skipped once the editor closes', () => {
    root.widgetSettings.setLayoutEditorOpen(true);

    goOnTrackInPractice();

    root.widgetSettings.setLayoutEditorOpen(false);

    expect(root.layouts.activeLayoutId).toBe('layout-practice');
  });

  it('stands down while the editor previews another layout too', () => {
    runInAction(() => {
      root.widgetSettings.editorPreviewMode = true;
    });

    goOnTrackInPractice();

    expect(root.layouts.activeLayoutId).toBe('layout-garage');
  });

  it('does nothing at all while auto-switching is off', () => {
    runInAction(() => {
      root.appSettings.appSettings.autoSwitchLayouts = false;
    });

    goOnTrackInPractice();

    expect(root.layouts.activeLayoutId).toBe('layout-garage');
  });
});

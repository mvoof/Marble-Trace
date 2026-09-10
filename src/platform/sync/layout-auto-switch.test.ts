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

    root.liveWidgets.setLayouts(
      [layout('layout-garage'), layout('layout-practice')],
      'layout-garage'
    );
    root.liveWidgets.setSessionLayouts({
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

    expect(root.layouts.editingLayoutId).toBe('layout-practice');
  });

  // Fixed three times, the last two in opposite directions. Auto-switch used to
  // pull the layout out from under whoever was editing it; standing down while
  // the editor was open then froze the driver's screen on the wrong layout for
  // as long as a window nobody was looking at stayed open. Neither happens now:
  // the two layouts are separate values, and the session moves only the live one.
  it('moves the screen while the editor keeps the layout it opened', () => {
    root.layoutEditor.setOpen(true);

    goOnTrackInPractice();

    expect(root.layouts.liveLayoutId).toBe('layout-practice');
    expect(root.layouts.editingLayoutId).toBe('layout-garage');
  });

  it('hands the screen back as the edited layout once the editor closes', () => {
    root.layoutEditor.setOpen(true);

    goOnTrackInPractice();

    root.layoutEditor.setOpen(false);

    expect(root.layouts.liveLayoutId).toBe('layout-practice');
    expect(root.layouts.editingLayoutId).toBe('layout-practice');
  });

  it('does nothing at all while auto-switching is off', () => {
    runInAction(() => {
      root.appSettings.appSettings.autoSwitchLayouts = false;
    });

    goOnTrackInPractice();

    expect(root.layouts.editingLayoutId).toBe('layout-garage');
  });
});

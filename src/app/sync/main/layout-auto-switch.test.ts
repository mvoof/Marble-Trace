import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runInAction, type IReactionDisposer } from 'mobx';

import { MainRoot } from '@app/roots/main-root';
import type { AutoSwitchRule } from '@shared/contracts/widget-settings';

// The reaction only reads the sim and writes the active layout; everything it
// would emit crosses the Tauri boundary, which is not what is under test.
vi.mock('@shared/api/events.service', () => ({
  emitLayoutActivated: vi.fn(),
  emitSessionLayoutsChanged: vi.fn(),
  emitToOverlays: vi.fn(),
  emitToOverlaysAndRemote: vi.fn(),
  listenTo: vi.fn(),
}));

vi.mock('@shared/api/settings.service', () => ({
  setTelemetrySettingsSilent: vi.fn(),
  setActiveEventsSilent: vi.fn(),
}));

const { registerLayoutAutoSwitchReaction } = await import('./main-sync');

const MONITOR = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const MERCEDES_GT3 = 156;

const rule = (
  layoutId: string,
  conditions: Partial<Omit<AutoSwitchRule, 'id' | 'layoutId'>>
): AutoSwitchRule => ({
  id: layoutId,
  context: null,
  carClass: null,
  carId: null,
  layoutId,
  ...conditions,
});

const layout = (id: string) => ({
  id,
  name: id,
  createdAt: 0,
  monitors: [MONITOR],
  widgets: [],
});

describe('session layout auto-switch', () => {
  let root: MainRoot;
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
        playerCarIdx: 0,
        cars: [
          {
            carIdx: 0,
            carId: MERCEDES_GT3,
            carScreenName: 'Mercedes-AMG GT3 2020',
            carClassShortName: 'GT3',
            isPaceCar: false,
            isSpectator: false,
          },
        ],
      } as unknown as typeof root.session.sessionInfo;
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    root = new MainRoot({ skipInit: true });

    root.liveWidgets.setLayouts(
      [
        layout('layout-garage'),
        layout('layout-practice'),
        layout('layout-mercedes'),
      ],
      'layout-garage'
    );
    root.layouts.setAutoSwitchRules([
      rule('layout-practice', { context: 'Practice' }),
      rule('layout-garage', { context: 'Garage' }),
    ]);

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

  it('puts on the layout of a rule naming the car over the session rule', () => {
    root.layouts.setAutoSwitchRules([
      rule('layout-practice', { context: 'Practice' }),
      rule('layout-mercedes', { carId: MERCEDES_GT3 }),
    ]);

    goOnTrackInPractice();

    expect(root.layouts.editingLayoutId).toBe('layout-mercedes');
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

  it('tells the overlay which layout it switched to', async () => {
    const { emitLayoutActivated } = await import('@shared/api/events.service');

    goOnTrackInPractice();

    expect(emitLayoutActivated).toHaveBeenCalledWith('layout-practice');
  });

  it('tells the overlay even while the editor holds another layout', async () => {
    const { emitLayoutActivated } = await import('@shared/api/events.service');

    root.layoutEditor.setOpen(true);
    goOnTrackInPractice();

    expect(emitLayoutActivated).toHaveBeenCalledWith('layout-practice');
  });

  it('does nothing at all while auto-switching is off', () => {
    runInAction(() => {
      root.appSettings.appSettings.autoSwitchLayouts = false;
    });

    goOnTrackInPractice();

    expect(root.layouts.editingLayoutId).toBe('layout-garage');
  });
});

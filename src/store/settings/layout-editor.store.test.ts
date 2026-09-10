import { describe, expect, it, vi, beforeEach } from 'vitest';

import { RootStore } from '@store/root-store';

// Nothing here crosses the Tauri boundary; the editing session is main-window
// state and the emits it would provoke are not what is under test.
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

describe('the layout under the editor and the one on screen', () => {
  let root: RootStore;

  beforeEach(() => {
    root = new RootStore({ skipInit: true });

    root.liveWidgets.setLayouts(
      [layout('layout-garage'), layout('layout-practice')],
      'layout-garage'
    );
  });

  it('leaves the screen alone while the editor opens another layout', () => {
    root.layoutEditor.setOpen(true);
    root.layoutEditor.switchLayout('layout-practice');

    expect(root.layouts.liveLayoutId).toBe('layout-garage');
    expect(root.layoutEditor.previewMode).toBe(true);
  });

  it('puts the edited layout on screen when the editor activates it', () => {
    root.layoutEditor.setOpen(true);
    root.layoutEditor.switchLayout('layout-practice');
    root.layoutEditor.activateLayout();

    expect(root.layouts.liveLayoutId).toBe('layout-practice');
    expect(root.layoutEditor.previewMode).toBe(false);
  });

  it('hands the live layout back as the edited one when the editor closes', () => {
    root.layoutEditor.setOpen(true);
    root.layoutEditor.switchLayout('layout-practice');

    root.layoutEditor.setOpen(false);

    expect(root.layouts.editingLayoutId).toBe('layout-garage');
    expect(root.layouts.liveLayoutId).toBe('layout-garage');
    expect(root.layoutEditor.previewMode).toBe(false);
  });
});

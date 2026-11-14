import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAutoObservable, runInAction } from 'mobx';

import {
  deleteBackgroundImage,
  saveBackgroundImage,
} from '@entities/layout/layout-background';

import {
  LayoutEditorUiStore,
  type LayoutEditorUiLayouts,
} from './layout-editor-ui.store';

vi.mock('@entities/layout/layout-background', () => ({
  saveBackgroundImage: vi.fn(),
  deleteBackgroundImage: vi.fn(),
}));

const SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };

const makeLayouts = () =>
  makeAutoObservable({
    editingLayoutId: 'race' as string | null,
    editingLayout: {
      monitors: [
        { name: 'LEFT', bounds: SCREEN },
        { name: 'RIGHT', bounds: { ...SCREEN, x: 1920 } },
      ],
      backgroundImages: { LEFT: 'old-left.png' } as Record<string, string>,
    },
    setMonitorBackground(monitorName: string, image: string | undefined) {
      if (image) {
        this.editingLayout.backgroundImages[monitorName] = image;
      } else {
        delete this.editingLayout.backgroundImages[monitorName];
      }
    },
  });

const makeStore = () => {
  const layouts = makeLayouts();
  const store = new LayoutEditorUiStore(
    layouts as unknown as LayoutEditorUiLayouts,
    'baseline'
  );

  return { layouts, store };
};

describe('LayoutEditorUiStore', () => {
  it('drops the selection when another layout is opened', () => {
    const { layouts, store } = makeStore();

    store.selectWidget('fuel');
    runInAction(() => {
      layouts.editingLayoutId = 'practice';
    });

    expect(store.selectedWidgetId).toBeNull();
    store.dispose();
  });

  it('reads an empty id as no selection', () => {
    const { store } = makeStore();

    store.selectWidget('');

    expect(store.selectedWidgetId).toBeNull();
    store.dispose();
  });

  it('pins and unpins a widget\u2019s ratio', () => {
    const { store } = makeStore();

    store.selectWidget('fuel');
    store.toggleRatioLock('fuel');
    expect(store.isSelectedRatioLocked).toBe(true);

    store.toggleRatioLock('fuel');
    expect(store.isSelectedRatioLocked).toBe(false);
    store.dispose();
  });

  it('closes the widget drawer when the overview comes back', () => {
    const { store } = makeStore();

    store.setFullscreen(true);
    store.setPanelOpen(true);
    store.setFullscreen(false);

    expect(store.viewMode).toBe('overview');
    expect(store.isPanelOpen).toBe(false);
    store.dispose();
  });
});

describe('LayoutEditorUiStore view modes', () => {
  it('opens on the overview of every screen', () => {
    const { store } = makeStore();

    expect(store.viewMode).toBe('overview');
    expect(store.focusedMonitorName).toBeNull();
    expect(store.isCanvasOnly).toBe(false);
    store.dispose();
  });

  it('goes full size on the screen picked in the overview', () => {
    const { store } = makeStore();

    store.focusMonitor('RIGHT');

    expect(store.viewMode).toBe('fullSize');
    expect(store.isCanvasOnly).toBe(true);
    store.dispose();
  });

  it('goes back to the overview when full size lets go of its screen', () => {
    const { store } = makeStore();

    store.focusMonitor('RIGHT');
    store.focusMonitor(null);

    expect(store.viewMode).toBe('overview');
    store.dispose();
  });

  it('goes full size on the first screen when none is in focus', () => {
    const { store } = makeStore();

    store.showFullSize();

    expect(store.viewMode).toBe('fullSize');
    expect(store.focusedMonitorName).toBe('LEFT');
    store.dispose();
  });

  it('keeps the screen in focus when going full size', () => {
    const { store } = makeStore();

    store.focusMonitor('RIGHT');
    store.showOverview();
    store.focusMonitor('RIGHT');
    store.showFullSize();

    expect(store.focusedMonitorName).toBe('RIGHT');
    store.dispose();
  });

  it('lets go of the screen in the overview', () => {
    const { store } = makeStore();

    store.focusMonitor('RIGHT');
    store.setPanelOpen(true);
    store.showOverview();

    expect(store.viewMode).toBe('overview');
    expect(store.focusedMonitorName).toBeNull();
    expect(store.isPanelOpen).toBe(false);
    store.dispose();
  });

  it('keeps the drawers between full size and fullscreen', () => {
    const { store } = makeStore();

    store.focusMonitor('RIGHT');
    store.setPanelOpen(true);
    store.setFullscreen(true);
    store.setFullscreen(false);

    expect(store.viewMode).toBe('fullSize');
    expect(store.focusedMonitorName).toBe('RIGHT');
    expect(store.isPanelOpen).toBe(true);
    store.dispose();
  });

  it('shows every screen in fullscreen when none is in focus, as before', () => {
    const { store } = makeStore();

    store.setFullscreen(true);
    store.focusMonitor('LEFT');
    store.focusMonitor(null);

    expect(store.viewMode).toBe('fullscreen');
    expect(store.isFullscreen).toBe(true);
    expect(store.focusedMonitorName).toBeNull();
    store.dispose();
  });
});

describe('LayoutEditorUiStore backgrounds', () => {
  beforeEach(() => {
    vi.mocked(saveBackgroundImage).mockReset();
    vi.mocked(deleteBackgroundImage).mockReset();
  });

  it('offers every screen but the focused one as a move target', () => {
    const { store } = makeStore();

    expect(store.unfocusedMonitorNames).toEqual(['LEFT', 'RIGHT']);

    store.focusMonitor('LEFT');
    expect(store.unfocusedMonitorNames).toEqual(['RIGHT']);
    store.dispose();
  });

  it('puts a picture on the first screen in the overview', async () => {
    const { layouts, store } = makeStore();

    vi.mocked(saveBackgroundImage).mockResolvedValue('new.png');
    store.setUploadingBackground(true);

    await store.setBackgroundFromFile(new File(['x'], 'shot.JPG'));

    expect(saveBackgroundImage).toHaveBeenCalledWith(
      'race',
      expect.any(Uint8Array),
      'jpg'
    );
    expect(deleteBackgroundImage).toHaveBeenCalledWith('old-left.png');
    expect(layouts.editingLayout.backgroundImages.LEFT).toBe('new.png');
    expect(store.isUploadingBackground).toBe(false);
    store.dispose();
  });

  it('puts a picture on the focused screen', async () => {
    const { layouts, store } = makeStore();

    vi.mocked(saveBackgroundImage).mockResolvedValue('right.png');
    store.focusMonitor('RIGHT');

    await store.setBackgroundFromFile(new File(['x'], 'shot.png'));

    expect(deleteBackgroundImage).not.toHaveBeenCalled();
    expect(layouts.editingLayout.backgroundImages.RIGHT).toBe('right.png');
    store.dispose();
  });

  it('ends the upload when the picker was dismissed', async () => {
    const { store } = makeStore();

    store.setUploadingBackground(true);
    await store.setBackgroundFromFile(undefined);

    expect(saveBackgroundImage).not.toHaveBeenCalled();
    expect(store.isUploadingBackground).toBe(false);
    store.dispose();
  });

  it('clears the screen’s picture and its file', () => {
    const { layouts, store } = makeStore();

    store.clearBackground();

    expect(deleteBackgroundImage).toHaveBeenCalledWith('old-left.png');
    expect(layouts.editingLayout.backgroundImages.LEFT).toBeUndefined();
    expect(store.currentBackground).toBeUndefined();
    store.dispose();
  });
});

describe('the monitor arrangement above the canvas', () => {
  it('is shown until the user hides it', () => {
    const { store } = makeStore();

    expect(store.isArrangementShown).toBe(true);

    store.setArrangementShown(false);

    expect(store.isArrangementShown).toBe(false);
    store.dispose();
  });

  it('stays hidden when another layout is opened', () => {
    const { layouts, store } = makeStore();

    store.setArrangementShown(false);
    store.showOverview();
    runInAction(() => {
      layouts.editingLayoutId = 'practice';
    });

    expect(store.isArrangementShown).toBe(false);
    store.dispose();
  });
});

import { describe, expect, it } from 'vitest';
import { makeAutoObservable, runInAction } from 'mobx';

import type { LayoutsStore } from '@entities/layout/layouts.store';

import { LayoutEditorUiStore } from './layout-editor-ui.store';

const makeLayouts = () =>
  makeAutoObservable({ editingLayoutId: 'race' as string | null });

const makeStore = () => {
  const layouts = makeLayouts();
  const store = new LayoutEditorUiStore(
    layouts as unknown as LayoutsStore,
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

  it('closes the widget drawer when fullscreen ends', () => {
    const { store } = makeStore();

    store.setFullscreen(true);
    store.setPanelOpen(true);
    store.setFullscreen(false);

    expect(store.isPanelOpen).toBe(false);
    store.dispose();
  });
});

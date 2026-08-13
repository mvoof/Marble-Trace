import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { RootStore } from '@store/root-store';
import { BindingsStore } from './bindings.store';
import { dispatchBinding } from './binding-runner';

const emitStandingsScroll = vi.hoisted(() => vi.fn());
const emitPitServiceToggle = vi.hoisted(() => vi.fn());

vi.mock('@platform/services/events.service', () => ({
  emitStandingsScroll,
  emitPitServiceToggle,
}));

const keyboard = (accelerator: string) =>
  ({ kind: 'keyboard', accelerator }) as const;

interface TestRoot {
  bindings: BindingsStore;
  widgetSettings: {
    isWidgetInActiveLayout: (id: string) => boolean;
    getWidget: (id: string) => { userSettings: { enabled: boolean } };
    setWidgetEnabled: (id: string, enabled: boolean) => void;
  };
  pitServiceWidget: { panel: { toggleManualShow: () => void } };
  appSettings: {
    appSettings: { interactHotkeyMode: 'toggle' | 'hold' };
    toggleDragMode: () => void;
    setInteractMode: (value: boolean) => void;
    toggleInteractMode: () => void;
  };
}

const makeRoot = (widgetsInLayout: string[]): TestRoot => ({
  bindings: new BindingsStore(),
  widgetSettings: {
    isWidgetInActiveLayout: (id: string) => widgetsInLayout.includes(id),
    getWidget: (id: string) => ({
      userSettings: { enabled: widgetsInLayout.includes(id) },
    }),
    setWidgetEnabled: vi.fn(),
  },
  pitServiceWidget: { panel: { toggleManualShow: vi.fn() } },
  appSettings: {
    appSettings: { interactHotkeyMode: 'toggle' },
    toggleDragMode: vi.fn(),
    setInteractMode: vi.fn(),
    toggleInteractMode: vi.fn(),
  },
});

const dispatch = (root: TestRoot, accelerator: string, pressed = true) =>
  dispatchBinding(root as unknown as RootStore, keyboard(accelerator), pressed);

describe('dispatchBinding', () => {
  beforeEach(() => {
    emitStandingsScroll.mockClear();
    emitPitServiceToggle.mockClear();
  });

  it('runs a widget action when its widget is in the layout', () => {
    const root = makeRoot(['standings']);

    root.bindings.applyBindings({ 'standings:scroll-up': [keyboard('F1')] });
    dispatch(root, 'F1');

    expect(emitStandingsScroll).toHaveBeenCalledTimes(1);
  });

  it('emits nothing when the owning widget is not in the layout', () => {
    const root = makeRoot([]);

    root.bindings.applyBindings({ 'standings:scroll-up': [keyboard('F1')] });
    dispatch(root, 'F1');

    expect(emitStandingsScroll).not.toHaveBeenCalled();
  });

  it('never gates an app action on the layout', () => {
    const root = makeRoot([]);

    root.bindings.applyBindings({ 'app:toggle-drag-mode': [keyboard('F9')] });
    dispatch(root, 'F9');

    expect(root.appSettings.toggleDragMode).toHaveBeenCalledTimes(1);
  });

  it('ignores the release edge for a press action', () => {
    const root = makeRoot([]);

    root.bindings.applyBindings({ 'app:toggle-drag-mode': [keyboard('F9')] });
    dispatch(root, 'F9', false);

    expect(root.appSettings.toggleDragMode).not.toHaveBeenCalled();
  });

  it('mirrors the key state for a hold action in hold mode', () => {
    const root = makeRoot([]);

    root.appSettings.appSettings.interactHotkeyMode = 'hold';
    root.bindings.applyBindings({
      'app:toggle-interact-mode': [keyboard('F8')],
    });

    dispatch(root, 'F8', true);
    dispatch(root, 'F8', false);

    expect(root.appSettings.setInteractMode).toHaveBeenNthCalledWith(1, true);
    expect(root.appSettings.setInteractMode).toHaveBeenNthCalledWith(2, false);
  });

  it('hides a widget that is on screen by switching it off in the layout', () => {
    const root = makeRoot(['standings']);

    root.bindings.applyBindings({
      'widget:standings:toggle-visibility': [keyboard('F5')],
    });

    dispatch(root, 'F5');

    expect(root.widgetSettings.setWidgetEnabled).toHaveBeenCalledWith(
      'standings',
      false
    );
  });

  // The one action allowed past the gate: it acts on the layout, not on the
  // widget, and gating it would make a switched-off widget unreachable.
  it('switches a widget back on even though it is not in the layout', () => {
    const root = makeRoot([]);

    root.bindings.applyBindings({
      'widget:standings:toggle-visibility': [keyboard('F5')],
    });

    dispatch(root, 'F5');

    expect(root.widgetSettings.setWidgetEnabled).toHaveBeenCalledWith(
      'standings',
      true
    );
  });

  it('fans one binding out to every action bound to it', () => {
    const root = makeRoot(['standings', 'pit-service']);

    root.bindings.applyBindings({
      'standings:scroll-up': [keyboard('F1')],
      'pit-service:toggle': [keyboard('F1')],
    });

    dispatch(root, 'F1');

    expect(emitStandingsScroll).toHaveBeenCalledTimes(1);
    expect(emitPitServiceToggle).toHaveBeenCalledTimes(1);
  });
});

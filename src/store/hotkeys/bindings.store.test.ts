import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_BY_ID, widgetVisibilityActionId } from './actions';
import { DEFAULT_WIDGETS } from '@store/widget-defaults';
import { BindingsStore } from './bindings.store';
import { bindingKey } from './binding-types';

const keyboard = (accelerator: string) =>
  ({ kind: 'keyboard', accelerator }) as const;

describe('ACTIONS registry', () => {
  it('covers every legacy hotkey field', () => {
    const expected = [
      'app:toggle-drag-mode',
      'app:toggle-interact-mode',
      'app:toggle-hide-all-widgets',
      'standings:cycle-view-mode',
      'standings:class-prev',
      'standings:class-next',
      'standings:scroll-up',
      'standings:scroll-down',
      'pit-service:toggle',
      'pit-service:auto-mode',
      'pit-service:apply-order',
      'pit-service:clear-order',
      'pit-service:fuel',
      'pit-service:tires-all',
      'pit-service:tire-lf',
      'pit-service:tire-rf',
      'pit-service:tire-lr',
      'pit-service:tire-rr',
      'pit-service:fast-repair',
      'pit-service:windshield',
    ];

    for (const id of expected) {
      expect(ACTION_BY_ID.has(id), id).toBe(true);
    }
  });

  // Show/hide is the only action allowed past the layout gate, and only because
  // it acts on the layout rather than on the widget. Anything else skipping the
  // gate would break the rule the feature exists to enforce.
  it('lets nothing but show/hide bypass the layout gate', () => {
    const exempt = ACTIONS.filter((action) => action.ignoreLayoutGate);

    expect(exempt.map((action) => action.id).sort()).toEqual(
      DEFAULT_WIDGETS.map((widget) =>
        widgetVisibilityActionId(widget.id)
      ).sort()
    );
  });

  it('gives every widget a show/hide action', () => {
    for (const widget of DEFAULT_WIDGETS) {
      const action = ACTION_BY_ID.get(widgetVisibilityActionId(widget.id));

      expect(action, widget.id).toBeDefined();
      expect(action?.owner, widget.id).toBe(widget.id);
    }
  });

  // An action that can quietly do nothing has to be able to say so, or the
  // press just vanishes.
  it('pairs every inert check with a hint to show', () => {
    for (const action of ACTIONS) {
      expect(Boolean(action.isInert), action.id).toBe(
        Boolean(action.inertHintKey)
      );
    }
  });

  // Pit service hides itself away from the pit lane, so it has two separate
  // keys: one puts it in the layout, the other reveals the order box on track.
  // The temporary one is gated — revealing a widget that is not in the layout
  // would show nothing.
  it('keeps the pit service reveal separate from its layout toggle', () => {
    const reveal = ACTION_BY_ID.get('pit-service:toggle');
    const inLayout = ACTION_BY_ID.get(widgetVisibilityActionId('pit-service'));

    expect(reveal?.ignoreLayoutGate).toBeUndefined();
    expect(inLayout?.ignoreLayoutGate).toBe(true);
    expect(reveal?.labelKey).not.toBe(inLayout?.labelKey);
  });

  it('only owns actions by app or by a real widget', () => {
    const widgetIds = new Set(DEFAULT_WIDGETS.map((widget) => widget.id));

    for (const action of ACTIONS) {
      expect(
        action.owner === 'app' || widgetIds.has(action.owner),
        action.id
      ).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(ACTIONS.map((action) => action.id)).size).toBe(
      ACTIONS.length
    );
  });
});

describe('BindingsStore', () => {
  it('ships the registry defaults', () => {
    const store = new BindingsStore();

    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([keyboard('F9')]);
  });

  it('ignores a binding for an action that no longer exists', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'gone:action': [keyboard('F1')],
      'app:toggle-drag-mode': [keyboard('F2')],
    });

    expect(store.bindings['gone:action']).toBeUndefined();
    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([keyboard('F2')]);
  });

  it('does not add the same binding twice', () => {
    const store = new BindingsStore();

    store.applyBindings({});
    store.addBinding('app:toggle-drag-mode', keyboard('F9'));
    store.addBinding('app:toggle-drag-mode', keyboard('F9'));

    expect(store.bindingsFor('app:toggle-drag-mode')).toHaveLength(1);
  });

  it('reports a key bound to two actions as a conflict without reassigning it', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'app:toggle-drag-mode': [keyboard('F9')],
      'app:toggle-hide-all-widgets': [keyboard('F9')],
    });

    expect(store.conflicts.get(bindingKey(keyboard('F9')))).toEqual([
      'app:toggle-drag-mode',
      'app:toggle-hide-all-widgets',
    ]);
    expect(
      store.conflictingActions('app:toggle-drag-mode', keyboard('F9'))
    ).toEqual(['app:toggle-hide-all-widgets']);
    expect(store.bindingsFor('app:toggle-hide-all-widgets')).toEqual([
      keyboard('F9'),
    ]);
  });

  it('drops the action entry when its last binding is removed', () => {
    const store = new BindingsStore();

    store.applyBindings({ 'app:toggle-drag-mode': [keyboard('F9')] });
    store.removeBinding('app:toggle-drag-mode', keyboard('F9'));

    expect(store.bindings['app:toggle-drag-mode']).toBeUndefined();
  });

  it('rewrites every binding of a device whose id changed', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'app:toggle-drag-mode': [
        { kind: 'device', deviceId: 'old', button: 3 },
        keyboard('F9'),
      ],
      'pit-service:fuel': [{ kind: 'device', deviceId: 'other', button: 1 }],
    });

    store.rewriteDeviceId('old', 'new');

    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([
      { kind: 'device', deviceId: 'new', button: 3 },
      keyboard('F9'),
    ]);
    expect(store.bindingsFor('pit-service:fuel')).toEqual([
      { kind: 'device', deviceId: 'other', button: 1 },
    ]);
  });

  it('deduplicates the accelerators it registers with the OS', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'app:toggle-drag-mode': [keyboard('F9')],
      'app:toggle-hide-all-widgets': [keyboard('F9')],
      'pit-service:fuel': [keyboard('F4')],
    });

    expect(store.keyboardAccelerators.sort()).toEqual(['F4', 'F9']);
  });
});

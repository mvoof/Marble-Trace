import { describe, expect, it } from 'vitest';
import { ACTIONS, ACTION_BY_ID, widgetVisibilityActionId } from './actions';
import { DEFAULT_WIDGETS } from '@store/widget-defaults';
import { BindingsStore, defaultBindingMap } from './bindings.store';
import { bindingKey } from '@/types/input-bindings';

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

  // Rolling back to an older build must not cost the user a binding they made
  // on the newer one: the id is unknown here, so it is kept on disk and simply
  // never dispatched.
  it('keeps a binding for an unknown action without dispatching it', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'gone:action': [keyboard('F1')],
      'app:toggle-drag-mode': [keyboard('F2')],
    });

    expect(store.bindings['gone:action']).toBeUndefined();
    expect(store.overrides['gone:action']).toEqual([keyboard('F1')]);
    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([keyboard('F2')]);
  });

  it('falls back to the registry default for an action it has no override for', () => {
    const store = new BindingsStore();

    store.applyBindings({ 'pit-service:fuel': [keyboard('F1')] });

    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([keyboard('F9')]);
  });

  // The whole point of overrides-only: a file written before an action existed
  // must not leave that action unbound.
  it('persists only what the user changed', () => {
    const store = new BindingsStore();

    store.applyBindings({});
    store.addBinding('pit-service:fuel', keyboard('F4'));

    expect(store.overrides).toEqual({ 'pit-service:fuel': [keyboard('F4')] });
    expect(store.bindings['app:toggle-drag-mode']).toEqual([keyboard('F9')]);
  });

  it('keeps the default when a second key is added on top of it', () => {
    const store = new BindingsStore();

    store.addBinding('app:toggle-drag-mode', keyboard('F2'));

    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([
      keyboard('F9'),
      keyboard('F2'),
    ]);
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

  // An absent entry means "use the default", so deleting it would hand the user
  // back the very key they just removed. Empty array is the unbound marker.
  it('marks an action unbound rather than dropping its entry', () => {
    const store = new BindingsStore();

    store.removeBinding('app:toggle-drag-mode', keyboard('F9'));

    expect(store.overrides['app:toggle-drag-mode']).toEqual([]);
    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([]);
  });

  it('keeps an action unbound across a save and load', () => {
    const store = new BindingsStore();

    store.clearAction('app:toggle-drag-mode');

    const reloaded = new BindingsStore();
    reloaded.applyBindings(store.overrides);

    expect(reloaded.bindingsFor('app:toggle-drag-mode')).toEqual([]);
  });

  it('goes back to shipping defaults when reset', () => {
    const store = new BindingsStore();

    store.clearAction('app:toggle-drag-mode');
    store.resetToDefaults();

    expect(store.overrides).toEqual({});
    expect(store.bindingsFor('app:toggle-drag-mode')).toEqual([keyboard('F9')]);
  });

  // rewriteDeviceId only walks the overrides, which is safe exactly as long as
  // no shipped default can name a device.
  it('ships no device bindings', () => {
    for (const [actionId, bindings] of Object.entries(defaultBindingMap())) {
      for (const binding of bindings) {
        expect(binding.kind, actionId).toBe('keyboard');
      }
    }
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

  // The effective map always carries every default, so the assertion is about
  // the deduplication itself rather than an exact list.
  it('deduplicates the accelerators it registers with the OS', () => {
    const store = new BindingsStore();

    store.applyBindings({
      'app:toggle-drag-mode': [keyboard('F9')],
      'app:toggle-hide-all-widgets': [keyboard('F9')],
      'pit-service:fuel': [keyboard('F4')],
    });

    const accelerators = store.keyboardAccelerators;

    expect(new Set(accelerators).size).toBe(accelerators.length);
    expect(accelerators).toContain('F9');
    expect(accelerators).toContain('F4');
  });
});

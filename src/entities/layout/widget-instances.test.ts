import { describe, expect, it } from 'vitest';

import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import {
  copyOrdinalAmong,
  detachedCopiesOf,
  insertAfter,
  monitorSwitchOf,
} from './widget-instances';

const instance = (
  id: string,
  monitor = 'DISPLAY1',
  enabled = true
): WidgetDefaultConfig =>
  ({
    id,
    type: 'standings',
    monitor,
    userSettings: { enabled },
  }) as WidgetDefaultConfig;

describe('monitorSwitchOf', () => {
  it('switches off only the instances that are on', () => {
    const on = instance('standings');
    const off = instance('standings-2', 'DISPLAY1', false);

    expect(monitorSwitchOf([on, off], false)).toEqual({
      kind: 'switchOff',
      widgets: [on],
    });
  });

  it('leaves a monitor with nothing on alone when switching off', () => {
    expect(
      monitorSwitchOf([instance('standings', 'DISPLAY1', false)], false)
    ).toEqual({ kind: 'unchanged', id: null });
  });

  it('answers with the instance already on', () => {
    expect(monitorSwitchOf([instance('standings')], true)).toEqual({
      kind: 'unchanged',
      id: 'standings',
    });
  });

  it('switches back on the first instance standing there', () => {
    const first = instance('standings', 'DISPLAY1', false);

    expect(
      monitorSwitchOf([first, instance('standings-2', 'DISPLAY1', false)], true)
    ).toEqual({ kind: 'switchOn', widget: first });
  });

  it('makes a new one when the monitor has none', () => {
    expect(monitorSwitchOf([], true)).toEqual({ kind: 'create' });
  });
});

describe('insertAfter', () => {
  it('puts a copy right after its source', () => {
    const widgets = [instance('standings'), instance('fuel')];

    insertAfter(widgets, 'standings', instance('standings-2'));

    expect(widgets.map((widget) => widget.id)).toEqual([
      'standings',
      'standings-2',
      'fuel',
    ]);
  });
});

describe('detachedCopiesOf', () => {
  it('copies each record and its settings', () => {
    const source = instance('standings');
    const [copy] = detachedCopiesOf([source]);

    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(copy.userSettings).not.toBe(source.userSettings);
  });
});

describe('copyOrdinalAmong', () => {
  it('counts the instances on the record’s own monitor', () => {
    const second = instance('standings-3', 'DISPLAY1');
    const all = [
      instance('standings', 'DISPLAY1'),
      instance('standings-2', 'DISPLAY2'),
      second,
    ];

    expect(copyOrdinalAmong(second, all)).toEqual({ ordinal: 2, total: 2 });
  });
});

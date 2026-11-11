import { describe, expect, it } from 'vitest';

import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import {
  shownWidgetIdsByZOrder,
  shownWidgetIdsOf,
  shownWidgetTypesOf,
} from './widget-visibility';

const widget = (
  id: string,
  type: string,
  enabled: boolean,
  zIndex = 0
): WidgetDefaultConfig =>
  ({ id, type, userSettings: { enabled, zIndex } }) as WidgetDefaultConfig;

const WIDGETS = [
  widget('fuel', 'fuel', true, 5),
  widget('standings', 'standings', true, 1),
  widget('standings-2', 'standings', true, 3),
  widget('radar', 'radar', false, 0),
  widget('inputs', 'inputs', true, 0),
];

describe('shownWidgetIdsOf', () => {
  it('keeps the switched-on, available widgets in list order', () => {
    expect(
      shownWidgetIdsOf(WIDGETS, ['fuel', 'standings', 'standings-2', 'radar'])
    ).toEqual(['fuel', 'standings', 'standings-2']);
  });
});

describe('shownWidgetIdsByZOrder', () => {
  it('orders them back to front', () => {
    expect(
      shownWidgetIdsByZOrder(WIDGETS, [
        'fuel',
        'standings',
        'standings-2',
        'inputs',
      ])
    ).toEqual(['inputs', 'standings', 'standings-2', 'fuel']);
  });
});

describe('shownWidgetTypesOf', () => {
  it('names each type once, sorted', () => {
    expect(
      shownWidgetTypesOf(WIDGETS, ['standings-2', 'standings', 'fuel'])
    ).toEqual(['fuel', 'standings']);
  });
});

import { describe, expect, it } from 'vitest';

import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';

import {
  hotkeyLeaderAmong,
  nextCycleValue,
  primaryInstanceAmong,
  visibilityAfterToggle,
} from './hotkey-targets';

const DISPLAY: LayoutMonitor = {
  name: 'DISPLAY1',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};

const BROWSER: LayoutMonitor = {
  name: 'tablet',
  kind: 'remote',
  bounds: { x: 0, y: 0, width: 1280, height: 800 },
} as LayoutMonitor;

const MONITORS = [DISPLAY, BROWSER];

const instance = (
  id: string,
  monitor: string,
  enabled: boolean,
  hotkeys?: boolean
): WidgetDefaultConfig =>
  ({
    id,
    type: 'standings',
    monitor,
    ...(hotkeys === undefined ? {} : { hotkeys }),
    userSettings: { enabled },
  }) as WidgetDefaultConfig;

describe('primaryInstanceAmong', () => {
  it('prefers a switched-on instance under the hotkeys', () => {
    const off = instance('standings', 'DISPLAY1', false);
    const on = instance('standings-2', 'DISPLAY1', true);

    expect(primaryInstanceAmong([off, on], MONITORS)).toBe(on);
  });

  it('puts the driver’s own screen ahead of a browser screen', () => {
    const onBrowser = instance('standings', 'tablet', true);
    const onDisplay = instance('standings-2', 'DISPLAY1', true);

    expect(primaryInstanceAmong([onBrowser, onDisplay], MONITORS)).toBe(
      onDisplay
    );
  });

  it('falls back to the first instance', () => {
    const first = instance('standings', 'DISPLAY1', false, false);
    const second = instance('standings-2', 'DISPLAY1', false, false);

    expect(primaryInstanceAmong([first, second], MONITORS)).toBe(first);
  });
});

describe('hotkeyLeaderAmong', () => {
  it('is the first marked instance when the primary one is unmarked', () => {
    const primary = instance('standings', 'DISPLAY1', true, false);
    const marked = instance('standings-2', 'DISPLAY1', false);

    expect(hotkeyLeaderAmong([primary, marked], MONITORS)).toBe(marked);
  });

  it('is nobody when nothing is marked', () => {
    expect(
      hotkeyLeaderAmong(
        [instance('standings', 'DISPLAY1', true, false)],
        MONITORS
      )
    ).toBeUndefined();
  });
});

describe('nextCycleValue', () => {
  it('steps to the next value and wraps round', () => {
    expect(nextCycleValue(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextCycleValue(['a', 'b', 'c'], 'c')).toBe('a');
  });

  it('starts from the first value when the current one is unknown', () => {
    expect(nextCycleValue(['a', 'b'], 'z')).toBe('a');
  });
});

describe('visibilityAfterToggle', () => {
  it('hides while any instance is on, shows when none is', () => {
    expect(
      visibilityAfterToggle([
        instance('standings', 'DISPLAY1', false),
        instance('standings-2', 'tablet', true),
      ])
    ).toBe(false);
    expect(
      visibilityAfterToggle([instance('standings', 'DISPLAY1', false)])
    ).toBe(true);
  });
});

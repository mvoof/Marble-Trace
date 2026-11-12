import { describe, expect, it } from 'vitest';

import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

import { adoptWidgetSet, isSameWidgetSet, patchFromSync } from './widget-sync';

// A type no manifest ships, so no derived design width interferes.
const PLAIN_TYPE = 'plain-test-widget';

const record = (
  id: string,
  overrides: Partial<WidgetDefaultConfig> = {}
): WidgetDefaultConfig =>
  ({
    id,
    type: PLAIN_TYPE,
    monitor: 'DISPLAY1',
    designWidth: 200,
    designHeight: 100,
    userSettings: { enabled: true, x: 0, y: 0 },
    ...overrides,
  }) as WidgetDefaultConfig;

const mapOf = (widgets: WidgetDefaultConfig[]) =>
  new Map(widgets.map((widget) => [widget.id, widget]));

describe('isSameWidgetSet', () => {
  it('is the same set whatever the order', () => {
    const known = mapOf([record('first'), record('second')]);

    expect(isSameWidgetSet(known, [record('second'), record('first')])).toBe(
      true
    );
  });

  it('differs when an instance appeared or went', () => {
    const known = mapOf([record('first'), record('second')]);

    expect(isSameWidgetSet(known, [record('first')])).toBe(false);
    expect(isSameWidgetSet(known, [record('first'), record('third')])).toBe(
      false
    );
  });
});

describe('patchFromSync', () => {
  it('carries the settings, the monitor and the design size onto the record', () => {
    const existing = record('first');
    const settings = existing.userSettings;

    patchFromSync(
      existing,
      record('first', {
        monitor: 'DISPLAY2',
        designHeight: 300,
        userSettings: {
          enabled: false,
          x: 40,
          y: 50,
        } as WidgetDefaultConfig['userSettings'],
      })
    );

    expect(existing.userSettings).toBe(settings);
    expect(existing.userSettings).toMatchObject({ enabled: false, x: 40 });
    expect(existing.monitor).toBe('DISPLAY2');
    expect(existing.designHeight).toBe(300);
  });

  it('drops a hotkey mark the incoming copy no longer has', () => {
    const existing = record('first', { hotkeys: false });

    patchFromSync(existing, record('first'));

    expect('hotkeys' in existing).toBe(false);
  });
});

describe('adoptWidgetSet', () => {
  it('keeps a known record, installs a new one, and drops a missing one', () => {
    const kept = record('kept');
    const known = mapOf([kept, record('gone')]);
    const incoming = record('new');

    const adopted = adoptWidgetSet(known, [
      record('kept', { monitor: 'DISPLAY2' }),
      incoming,
    ]);

    expect(adopted.map((widget) => widget.id)).toEqual(['kept', 'new']);
    expect(adopted[0]).toBe(kept);
    expect(kept.monitor).toBe('DISPLAY2');
    expect(adopted[1]).not.toBe(incoming);
    expect(adopted[1].userSettings).not.toBe(incoming.userSettings);
  });
});

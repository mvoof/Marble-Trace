import { describe, expect, it } from 'vitest';

import { RemoteScreenStore } from './remote-screen.store';
import type { RemoteScreenSnapshot } from '@/types/remote';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

const widget = (
  id: string,
  overrides: Partial<Record<string, number | boolean>> = {}
): WidgetDefaultConfig =>
  ({
    id,
    label: id,
    designWidth: 400,
    designHeight: 200,
    userSettings: {
      enabled: true,
      x: 2000,
      y: 120,
      currentWidth: 400,
      currentHeight: 200,
      ...overrides,
    },
  }) as unknown as WidgetDefaultConfig;

const snapshot = (
  widgets: WidgetDefaultConfig[],
  background?: string
): RemoteScreenSnapshot =>
  ({
    slug: 'stream',
    name: 'Stream',
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    widgets,
    units: 'metric',
    language: 'en',
    steeringLock: 900,
    layoutName: 'Race',
    background,
  }) as RemoteScreenSnapshot;

describe('what a remote screen paints behind its widgets', () => {
  it('contributes no ground when the screen was set transparent', () => {
    const screen = new RemoteScreenStore('stream');

    screen.setSnapshot(snapshot([widget('standings')], 'transparent'));

    expect(screen.isTransparent).toBe(true);
  });

  it('paints a ground of its own by default', () => {
    const screen = new RemoteScreenStore('tablet');

    screen.setSnapshot(snapshot([widget('standings')]));

    expect(screen.isTransparent).toBe(false);
    expect(screen.background).toBe('#000000');
  });
});

describe('a remote screen opened for one widget', () => {
  it('becomes that widget rectangle instead of the screen', () => {
    const screen = new RemoteScreenStore('stream', 'standings-2');

    screen.setSnapshot(
      snapshot([
        widget('standings'),
        widget('standings-2', { x: 2400, y: 300, currentWidth: 500 }),
      ])
    );

    expect(screen.bounds).toEqual({
      x: 2400,
      y: 300,
      width: 500,
      height: 200,
    });
    expect(screen.enabledWidgets.map((entry) => entry.id)).toEqual([
      'standings-2',
    ]);
  });

  // The streamer asked for this widget by id; a blank source with no
  // explanation is the worst possible answer to that.
  it('draws it even while the layout has it switched off', () => {
    const screen = new RemoteScreenStore('stream', 'standings-2');

    screen.setSnapshot(
      snapshot([widget('standings-2', { enabled: false })], '#101010')
    );

    expect(screen.enabledWidgets).toHaveLength(1);
    expect(screen.isTransparent).toBe(true);
  });

  it('waits rather than drawing the whole screen when the widget is gone', () => {
    const screen = new RemoteScreenStore('stream', 'standings-2');

    screen.setSnapshot(snapshot([widget('standings')]));

    expect(screen.isReady).toBe(false);
    expect(screen.enabledWidgets).toHaveLength(0);
  });
});

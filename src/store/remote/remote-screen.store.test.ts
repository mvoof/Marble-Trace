import { describe, expect, it } from 'vitest';

import { RemoteScreenStore } from './remote-screen.store';
import type { ClientSnapshot } from '@/types/client-protocol';
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
): ClientSnapshot =>
  ({
    monitor: {
      name: 'Stream',
      kind: 'remote',
      slug: 'stream',
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      background,
    },
    widgets,
    units: 'metric',
    language: 'en',
    steeringLock: 900,
    layoutName: 'Race',
  }) as ClientSnapshot;

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

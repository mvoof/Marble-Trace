import { describe, it, expect } from 'vitest';
import { placeWidgetOnMonitor } from './virtual-desktop';
import type {
  MonitorBounds,
  WidgetDefaultConfig,
} from '@/types/widget-settings';

const SCREEN: MonitorBounds = { x: 0, y: 0, width: 1920, height: 1080 };

const makeWidget = (
  overrides: Partial<WidgetDefaultConfig['userSettings']> = {}
): WidgetDefaultConfig =>
  ({
    id: 'pit-service',
    label: 'Pit Service',
    designWidth: 235,
    designHeight: 330,
    autoHeight: true,
    userSettings: {
      enabled: true,
      x: 100,
      y: 900,
      currentWidth: 235,
      currentHeight: 330,
      ...overrides,
    },
  }) as WidgetDefaultConfig;

describe('placeWidgetOnMonitor', () => {
  it('leaves a widget alone when the monitor has not moved', () => {
    const widget = makeWidget();

    const placed = placeWidgetOnMonitor(widget, SCREEN, { ...SCREEN });

    expect(placed).toBe(widget);
    expect(placed.userSettings.y).toBe(900);
  });

  it('keeps the relative placement when the monitor really moves', () => {
    const placed = placeWidgetOnMonitor(makeWidget({ x: 0, y: 0 }), SCREEN, {
      x: 1920,
      y: 0,
      width: 1920,
      height: 1080,
    });

    expect(placed.userSettings.x).toBe(1920);
    expect(placed.userSettings.y).toBe(0);
  });
});

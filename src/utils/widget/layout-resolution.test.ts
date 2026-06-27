import { describe, it, expect } from 'vitest';
import {
  resolutionsEqual,
  scaleWidgetsToResolution,
} from './layout-resolution';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

const makeWidget = (
  overrides: Partial<WidgetDefaultConfig['userSettings']> = {}
): WidgetDefaultConfig =>
  ({
    id: 'test',
    label: 'Test',
    designWidth: 200,
    designHeight: 100,
    userSettings: {
      enabled: true,
      x: 100,
      y: 200,
      currentWidth: 400,
      currentHeight: 200,
      opacity: 1,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      ...overrides,
    },
  }) as WidgetDefaultConfig;

describe('resolutionsEqual', () => {
  it('compares width and height', () => {
    expect(
      resolutionsEqual(
        { width: 1920, height: 1080 },
        { width: 1920, height: 1080 }
      )
    ).toBe(true);

    expect(
      resolutionsEqual(
        { width: 1920, height: 1080 },
        { width: 3440, height: 1440 }
      )
    ).toBe(false);
  });
});

describe('scaleWidgetsToResolution', () => {
  it('returns the same widgets when resolutions match', () => {
    const widgets = [makeWidget()];
    const from = { width: 1920, height: 1080 };

    expect(scaleWidgetsToResolution(widgets, from, { ...from })).toBe(widgets);
  });

  it('scales position per-axis and size uniformly', () => {
    const widgets = [makeWidget()];

    const scaled = scaleWidgetsToResolution(
      widgets,
      { width: 1920, height: 1080 },
      { width: 3840, height: 2160 }
    );

    // 2x both axes -> position doubles, size doubles (uniform min ratio = 2)
    expect(scaled[0].userSettings.x).toBe(200);
    expect(scaled[0].userSettings.y).toBe(400);
    expect(scaled[0].userSettings.currentWidth).toBe(800);
    expect(scaled[0].userSettings.currentHeight).toBe(400);
  });

  it('uses the smaller axis ratio for size on differing aspect ratios', () => {
    const widgets = [makeWidget({ x: 1920, y: 1080, currentWidth: 200 })];

    const scaled = scaleWidgetsToResolution(
      widgets,
      { width: 1920, height: 1080 },
      { width: 3440, height: 1440 }
    );

    const widthRatio = 3440 / 1920; // ~1.7917
    const heightRatio = 1440 / 1080; // ~1.3333 (smaller)

    expect(scaled[0].userSettings.x).toBe(Math.round(1920 * widthRatio));
    expect(scaled[0].userSettings.y).toBe(Math.round(1080 * heightRatio));
    expect(scaled[0].userSettings.currentWidth).toBe(
      Math.round(200 * heightRatio)
    );
  });

  it('does not mutate the input widgets', () => {
    const widgets = [makeWidget()];

    scaleWidgetsToResolution(
      widgets,
      { width: 1920, height: 1080 },
      { width: 3840, height: 2160 }
    );

    expect(widgets[0].userSettings.x).toBe(100);
    expect(widgets[0].userSettings.currentWidth).toBe(400);
  });
});

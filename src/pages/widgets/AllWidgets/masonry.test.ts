import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGETS } from '@entities/widget/widget-catalog';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { masonryColumns, miniatureGeometry } from './masonry';

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const widgetSized = (
  overrides: Partial<WidgetDefaultConfig>,
  size: { currentWidth: number; currentHeight: number }
): WidgetDefaultConfig => {
  const base = DEFAULT_WIDGETS[0];

  return {
    ...base,
    designWidth: 400,
    designHeight: 200,
    autoHeight: false,
    contentSized: false,
    scaleFromHeight: false,
    ...overrides,
    userSettings: { ...base.userSettings, ...size },
  };
};

describe('masonryColumns', () => {
  it('fits as many equal columns as the width holds, gaps included', () => {
    // 4 columns of 220 and 3 gaps of 14 need 922 px.
    expect(masonryColumns(922, LETTERS).width).toBe(220);
    expect(masonryColumns(922, LETTERS).columns).toHaveLength(4);
    expect(masonryColumns(921, LETTERS).columns).toHaveLength(3);
  });

  it('deals the items across the columns so each row reads in order', () => {
    const { columns } = masonryColumns(700, LETTERS);

    expect(columns).toEqual([
      ['a', 'd', 'g'],
      ['b', 'e'],
      ['c', 'f'],
    ]);
  });

  it('keeps one column, as wide as the box, when it is narrower than one', () => {
    const { columns, width } = masonryColumns(150, LETTERS);

    expect(columns).toEqual([LETTERS]);
    expect(width).toBe(150);
  });
});

describe('miniatureGeometry', () => {
  it('fills the column, keeping the stored proportions and scaling the content with them', () => {
    // Stored at 800×400, twice its 400 design width: --wfs 2. At 200 wide it
    // is a quarter of that, so 0.5.
    const widget = widgetSized({}, { currentWidth: 800, currentHeight: 400 });

    expect(miniatureGeometry(widget, 200)).toEqual({
      width: 200,
      height: 100,
      scale: 0.5,
    });
  });

  it('fits a tall widget by its height so it never runs down the whole column', () => {
    // 100×600 at 200 wide would be 1200 tall; capped at 300 (1.5 × 200) it is
    // 50 wide.
    const widget = widgetSized(
      { designWidth: 100, designHeight: 600 },
      { currentWidth: 100, currentHeight: 600 }
    );

    expect(miniatureGeometry(widget, 200)).toEqual({
      width: 50,
      height: 300,
      scale: 0.5,
    });
  });

  it('leaves the height to a widget that sizes it itself', () => {
    const widget = widgetSized(
      { autoHeight: true },
      { currentWidth: 400, currentHeight: 900 }
    );

    expect(miniatureGeometry(widget, 200)).toEqual({
      width: 200,
      height: 'auto',
      scale: 0.5,
    });
  });

  it('leaves both axes to a widget sized by its content', () => {
    const widget = widgetSized(
      { contentSized: true },
      { currentWidth: 400, currentHeight: 200 }
    );

    expect(miniatureGeometry(widget, 200)).toEqual({
      width: 'auto',
      height: 'auto',
      scale: 0.5,
    });
  });
});

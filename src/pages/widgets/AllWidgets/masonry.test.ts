import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGETS } from '@entities/widget/widget-catalog';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import {
  catalogColumns,
  miniatureGeometry,
  rowSpan,
  tileSpan,
} from './masonry';

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

describe('catalogColumns', () => {
  it('fills the width with as many columns as fit, widening them as the window grows', () => {
    // Columns of at least 200 with 14 between: 922 px holds four of 220.
    expect(catalogColumns(922)).toEqual({ count: 4, width: 220 });
    // 1442 px holds six, each 1372 / 6 wide.
    expect(catalogColumns(1442)).toEqual({ count: 6, width: 1372 / 6 });
  });

  it('keeps one column, as wide as the box, when it is narrower than one', () => {
    expect(catalogColumns(150)).toEqual({ count: 1, width: 150 });
  });
});

describe('tileSpan', () => {
  it('gives a wider widget more columns', () => {
    const standings = widgetSized(
      {},
      { currentWidth: 974, currentHeight: 500 }
    );
    const relative = widgetSized({}, { currentWidth: 453, currentHeight: 400 });
    const delta = widgetSized({}, { currentWidth: 200, currentHeight: 100 });

    expect(tileSpan(standings, 6)).toBe(3);
    expect(tileSpan(relative, 6)).toBe(2);
    expect(tileSpan(delta, 6)).toBe(1);
  });

  it('gives up the columns a widget fitted by its height would leave empty', () => {
    // 1200×600 earns four columns of 200, 842 px; held to 300 px high it is
    // only 600 wide, which three columns (628 px) hold.
    const wide = widgetSized({}, { currentWidth: 1200, currentHeight: 600 });

    expect(tileSpan(wide, 6, { columnWidth: 200, maxHeight: 300 })).toBe(3);
  });

  it('never spans more columns than the grid has', () => {
    const standings = widgetSized(
      {},
      { currentWidth: 974, currentHeight: 500 }
    );

    expect(tileSpan(standings, 2)).toBe(2);
  });
});

describe('rowSpan', () => {
  it('spans the rows a card and the gap below it take', () => {
    // 100 px of card and 14 of gap, in 2 px rows.
    expect(rowSpan(100)).toBe(57);
  });
});

describe('miniatureGeometry', () => {
  it('fills the column, keeping the stored proportions and scaling the content with them', () => {
    // Stored at 800×400, twice its 400 design width: --wfs 2. At 200 wide it
    // is a quarter of that, so 0.5.
    const widget = widgetSized({}, { currentWidth: 800, currentHeight: 400 });

    expect(miniatureGeometry(widget, 200, 300)).toEqual({
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

    expect(miniatureGeometry(widget, 200, 300)).toEqual({
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

    expect(miniatureGeometry(widget, 200, 300)).toEqual({
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

    expect(miniatureGeometry(widget, 200, 300)).toEqual({
      width: 'auto',
      height: 'auto',
      scale: 0.5,
    });
  });
});

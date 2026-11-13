import { describe, expect, it } from 'vitest';

import {
  NAME_COLUMN_DEFAULT_PX,
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
  buildRelativeBlockEnds,
  buildRelativeGridTemplate,
  computeRelativeDesignWidth,
  visibleRelativeColumns,
} from '@widgets/relative/relative-utils';
import {
  RELATIVE_SETTINGS,
  type RelativeWidgetSettings,
} from './settings-schema';
import { RELATIVE_COLUMNS, type RelativeColumn } from './relative-columns';

const settingsWith = (nameColumnWidth: number) =>
  ({
    nameColumnWidth,
    showLicBadge: false,
    showIRating: false,
  }) as unknown as RelativeWidgetSettings;

describe('name column width', () => {
  it('narrows the widget by exactly what the name column loses', () => {
    const wide = computeRelativeDesignWidth(
      settingsWith(NAME_COLUMN_DEFAULT_PX)
    );
    const narrow = computeRelativeDesignWidth(
      settingsWith(NAME_COLUMN_DEFAULT_PX - 40)
    );

    expect(wide - narrow).toBe(40);
  });

  it('clamps a width outside the slider range', () => {
    expect(computeRelativeDesignWidth(settingsWith(5))).toBe(
      computeRelativeDesignWidth(settingsWith(NAME_COLUMN_MIN_PX))
    );
    expect(computeRelativeDesignWidth(settingsWith(9999))).toBe(
      computeRelativeDesignWidth(settingsWith(NAME_COLUMN_MAX_PX))
    );
  });

  it('has no elastic column at all — the row is exactly its columns wide', () => {
    const template = buildRelativeGridTemplate(
      settingsWith(NAME_COLUMN_DEFAULT_PX)
    );

    expect(template).not.toContain('fr');
  });
});

describe('distance column', () => {
  it('widens the widget and adds a column when shown', () => {
    const base = settingsWith(NAME_COLUMN_DEFAULT_PX);
    const withDistance = {
      ...base,
      showDistance: true,
    } as RelativeWidgetSettings;

    expect(computeRelativeDesignWidth(withDistance)).toBeGreaterThan(
      computeRelativeDesignWidth(base)
    );
    expect(buildRelativeGridTemplate(withDistance).split(' calc').length).toBe(
      buildRelativeGridTemplate(base).split(' calc').length + 1
    );
  });
});

describe('column order', () => {
  const withOrder = (
    columnOrder: readonly RelativeColumn[]
  ): RelativeWidgetSettings => ({
    ...RELATIVE_SETTINGS.defaults,
    columnOrder,
  });

  it('draws the visible columns in the shipped order by default', () => {
    expect(visibleRelativeColumns(RELATIVE_SETTINGS.defaults)).toEqual([
      'pos',
      'carNumber',
      'name',
      'sr',
      'ir',
      'gap',
    ]);
  });

  it('draws the columns in the order the settings give', () => {
    const reordered = withOrder([
      'gap',
      ...RELATIVE_COLUMNS.filter((column) => column !== 'gap'),
    ]);

    expect(visibleRelativeColumns(reordered)).toEqual([
      'gap',
      'pos',
      'carNumber',
      'name',
      'sr',
      'ir',
    ]);
    expect(computeRelativeDesignWidth(reordered)).toBe(
      computeRelativeDesignWidth(RELATIVE_SETTINGS.defaults)
    );
  });

  it('closes the driver and rating groups with a rule', () => {
    expect([...buildRelativeBlockEnds(RELATIVE_SETTINGS.defaults)]).toEqual([
      'name',
      'ir',
    ]);
  });

  it('closes a group wherever the next column belongs to another', () => {
    const gapFirst = withOrder([
      'gap',
      ...RELATIVE_COLUMNS.filter((column) => column !== 'gap'),
    ]);

    expect([...buildRelativeBlockEnds(gapFirst)]).toEqual(['gap', 'name']);
  });
});

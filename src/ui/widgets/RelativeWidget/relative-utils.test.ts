import { describe, expect, it } from 'vitest';

import type { RelativeWidgetSettings } from '@/types/widget-settings';
import {
  NAME_COLUMN_DEFAULT_PX,
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
  buildRelativeGridTemplate,
  computeRelativeDesignWidth,
} from '@ui/widgets/RelativeWidget/relative-utils';

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

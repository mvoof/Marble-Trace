import { describe, expect, it } from 'vitest';

import { makeColumnLayoutResolver } from './widget-manifest';
import type { WidgetUserSettings } from '@/types/widget-settings';

interface RailSettings {
  showRail: boolean;
  label: string;
}

const BASE_WIDTH = 235;
const RAIL_WIDTH = 58;

const resolver = makeColumnLayoutResolver<RailSettings>(
  ['showRail'],
  (settings) => BASE_WIDTH + (settings.showRail ? RAIL_WIDTH : 0)
);

const settings = (showRail: boolean): WidgetUserSettings =>
  ({ showRail, label: 'unchanged' }) as unknown as WidgetUserSettings;

describe('makeColumnLayoutResolver', () => {
  it('ignores a change to a setting that does not move the width', () => {
    expect(
      resolver(settings(false), settings(false), {
        designWidth: BASE_WIDTH,
        designHeight: 330,
        currentWidth: BASE_WIDTH,
        currentHeight: 330,
      })
    ).toBeNull();
  });

  it('adds exactly what the toggle is worth', () => {
    expect(
      resolver(settings(false), settings(true), {
        designWidth: BASE_WIDTH,
        designHeight: 330,
        currentWidth: BASE_WIDTH,
        currentHeight: 330,
      })
    ).toEqual({
      designWidth: BASE_WIDTH + RAIL_WIDTH,
      currentWidth: BASE_WIDTH + RAIL_WIDTH,
    });
  });

  it('keeps the scale the driver resized the widget to', () => {
    expect(
      resolver(settings(false), settings(true), {
        designWidth: BASE_WIDTH,
        designHeight: 330,
        currentWidth: BASE_WIDTH * 2,
        currentHeight: 660,
      })
    ).toEqual({
      designWidth: BASE_WIDTH + RAIL_WIDTH,
      currentWidth: (BASE_WIDTH + RAIL_WIDTH) * 2,
    });
  });

  // The regression this is here for: a settings file written before the widget
  // was redesigned carries the old design width. Toggling a column must move it
  // by the column, not re-derive it from today's manifest and hand the driver a
  // resize they never asked for.
  it('leaves a design width from an older build where it is', () => {
    const OLD_WIDTH = 300;

    expect(
      resolver(settings(false), settings(true), {
        designWidth: OLD_WIDTH,
        designHeight: 540,
        currentWidth: OLD_WIDTH,
        currentHeight: 540,
      })
    ).toEqual({
      designWidth: OLD_WIDTH + RAIL_WIDTH,
      currentWidth: OLD_WIDTH + RAIL_WIDTH,
    });
  });

  it('gives the width back when the toggle goes off again', () => {
    const OLD_WIDTH = 300;

    expect(
      resolver(settings(true), settings(false), {
        designWidth: OLD_WIDTH + RAIL_WIDTH,
        designHeight: 540,
        currentWidth: OLD_WIDTH + RAIL_WIDTH,
        currentHeight: 540,
      })
    ).toEqual({ designWidth: OLD_WIDTH, currentWidth: OLD_WIDTH });
  });
});

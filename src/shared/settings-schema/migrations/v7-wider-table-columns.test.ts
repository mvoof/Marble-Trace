import { describe, expect, it } from 'vitest';

import { STANDINGS_SETTINGS } from '@widgets/standings/settings-schema';
import { computeStandingsDesignWidth } from '@widgets/standings/standings-utils';
import { RELATIVE_SETTINGS } from '@widgets/relative/settings-schema';
import { computeRelativeDesignWidth } from '@widgets/relative/relative-utils';
import { FUEL_MANIFEST } from '@widgets/fuel/manifest';
import { LAP_LOG_MANIFEST } from '@widgets/lap-log/manifest';
import { SECTOR_MATRIX_MANIFEST } from '@widgets/sector-matrix/manifest';
import { v7WiderTableColumns } from './v7-wider-table-columns';

// What v6 derived for the shipped settings: the frames on disk were drawn
// against these.
const STANDINGS_V6_DEFAULT_WIDTH = 802;
const RELATIVE_V6_DEFAULT_WIDTH = 430;
const FUEL_V6_DEFAULT_WIDTH = 240;
const LAP_LOG_V6_DEFAULT_WIDTH = 220;
const SECTOR_MATRIX_V6_DEFAULT_WIDTH = 320;

const instance = (
  type: string,
  width: number,
  extra: Record<string, unknown> = {}
) => ({
  id: type,
  type,
  enabled: true,
  frame: { x: 10, y: 20, width, height: 500 },
  settings: {},
  ...extra,
});

const fileWith = (widgets: unknown[], templates?: unknown) => ({
  schemaVersion: 6,
  layouts: [
    {
      id: 'race',
      name: 'Race',
      createdAt: 1,
      monitors: [{ name: 'MAIN', widgets }],
    },
  ],
  ...(templates === undefined ? {} : { widgetTemplates: templates }),
});

const widgetsOf = (blob: Record<string, unknown>) =>
  (
    blob['layouts'] as Array<{
      monitors: Array<{ widgets: Array<Record<string, unknown>> }>;
    }>
  )[0].monitors[0].widgets;

const frameWidthOf = (widget: Record<string, unknown>) =>
  (widget['frame'] as { width: number }).width;

describe('v7 — table frames widened with their columns', () => {
  it('lands a default table on exactly the width this build derives', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([
        instance('standings', STANDINGS_V6_DEFAULT_WIDTH),
        instance('relative', RELATIVE_V6_DEFAULT_WIDTH),
      ])
    );

    const [standings, relative] = widgetsOf(migrated);

    expect(frameWidthOf(standings)).toBe(
      computeStandingsDesignWidth(STANDINGS_SETTINGS.defaults)
    );
    expect(frameWidthOf(relative)).toBe(
      computeRelativeDesignWidth(RELATIVE_SETTINGS.defaults)
    );
  });

  it('keeps the scale the driver gave the table', () => {
    const doubled = STANDINGS_V6_DEFAULT_WIDTH * 2;
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('standings', doubled)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      computeStandingsDesignWidth(STANDINGS_SETTINGS.defaults) * 2
    );
  });

  it('reads the columns the instance turned off', () => {
    const settings = {
      showInterval: false,
      showLapDelta: false,
      showBrand: false,
      nameColumnWidth: 150,
    };
    const v6Width = 802 - 36 - 2 - 50;

    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('standings', v6Width, { settings })])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      computeStandingsDesignWidth({
        ...STANDINGS_SETTINGS.defaults,
        ...settings,
      })
    );
  });

  it('leaves a widget with its own design size to the load path', () => {
    const design = { width: 900, height: 500 };
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('standings', 900, { design })])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(900);
  });

  it('leaves every other widget alone', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('weather', 300)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(300);
  });

  it('lands a default fuel frame on the mockup card width', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('fuel', FUEL_V6_DEFAULT_WIDTH)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      FUEL_MANIFEST.designWidth
    );
  });

  it('keeps the text size of a fuel frame the driver resized', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('fuel', 229)])
    );

    const [fuel] = widgetsOf(migrated);
    const frame = fuel['frame'] as { width: number; height: number };

    expect(frame.width / FUEL_MANIFEST.designWidth).toBeCloseTo(
      229 / FUEL_V6_DEFAULT_WIDTH,
      2
    );
    expect(frame.height).toBe(Math.round(500 * (306 / 240)));
  });

  it('leaves a fuel frame with a design size of its own', () => {
    const design = { width: 240, height: 360 };
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('fuel', 240, { design })])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(240);
  });

  it('widens the fuel template', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([], {
        fuel: {
          enabled: true,
          size: { width: FUEL_V6_DEFAULT_WIDTH, height: 360 },
          settings: {},
        },
      })
    );

    const templates = migrated['widgetTemplates'] as Record<
      string,
      { size: { width: number } }
    >;

    expect(templates['fuel'].size.width).toBe(FUEL_MANIFEST.designWidth);
  });

  it('lands a default lap log frame on the mockup card width', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('lap-log', LAP_LOG_V6_DEFAULT_WIDTH)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      LAP_LOG_MANIFEST.designWidth
    );
  });

  it('gives a lap log frame its design height at the frame scale', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('lap-log', LAP_LOG_V6_DEFAULT_WIDTH)])
    );

    const frame = widgetsOf(migrated)[0]['frame'] as { height: number };

    expect(frame.height).toBe(LAP_LOG_MANIFEST.designHeight);
  });

  it('keeps the text size of a lap log frame the driver resized', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('lap-log', 300)])
    );

    expect(
      frameWidthOf(widgetsOf(migrated)[0]) / LAP_LOG_MANIFEST.designWidth
    ).toBeCloseTo(300 / LAP_LOG_V6_DEFAULT_WIDTH, 2);
  });

  it('widens the lap log template', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([], {
        'lap-log': {
          enabled: true,
          size: { width: LAP_LOG_V6_DEFAULT_WIDTH, height: 260 },
          settings: {},
        },
      })
    );

    const templates = migrated['widgetTemplates'] as Record<
      string,
      { size: { width: number } }
    >;

    expect(templates['lap-log'].size.width).toBe(LAP_LOG_MANIFEST.designWidth);
  });

  it('lands a default sector matrix frame on the mockup card width', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('sector-matrix', SECTOR_MATRIX_V6_DEFAULT_WIDTH)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      SECTOR_MATRIX_MANIFEST.designWidth
    );
  });

  it('keeps the text size of a sector matrix frame the driver resized', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([instance('sector-matrix', 400)])
    );

    expect(frameWidthOf(widgetsOf(migrated)[0])).toBe(
      Math.round(400 * (330 / 320))
    );
  });

  it('widens the templates a new layout is built from', () => {
    const migrated = v7WiderTableColumns.migrate(
      fileWith([], {
        standings: {
          enabled: true,
          size: { width: STANDINGS_V6_DEFAULT_WIDTH, height: 500 },
          settings: {},
        },
      })
    );

    const templates = migrated['widgetTemplates'] as Record<
      string,
      { size: { width: number } }
    >;

    expect(templates['standings'].size.width).toBe(
      computeStandingsDesignWidth(STANDINGS_SETTINGS.defaults)
    );
  });

  it('survives a frame that is not a number', () => {
    const broken = { ...instance('relative', 0), frame: { width: 'wide' } };

    expect(() => v7WiderTableColumns.migrate(fileWith([broken]))).not.toThrow();
  });
});

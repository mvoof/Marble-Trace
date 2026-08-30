import { describe, expect, it } from 'vitest';
import { v3WidgetShapes } from './v3-widget-shapes';
import type { SettingsBlob } from '../types';

const SQUARE = { currentWidth: 180, currentHeight: 180 };
const SQUARE_DESIGN = { designWidth: 180, designHeight: 180 };

// The widgets a driver sees live in the active layout, so that is where a shape
// change has to land. The top-level list this step removes has a describe of
// its own at the bottom.
const inLayout = (widgets: unknown[]): SettingsBlob => ({
  layouts: [{ id: 'race', widgets }],
});

const layoutWidgets = (blob: SettingsBlob) =>
  (blob['layouts'] as { widgets: unknown[] }[])[0].widgets;

describe('v3 — car length to app settings', () => {
  it('lifts the value out of the radar and drops it from the widget', () => {
    const migrated = v3WidgetShapes.migrate({
      app: { steeringLock: 900 },
      ...inLayout([
        { id: 'proximity-radar', userSettings: { carLength: 5.2 } },
      ]),
    });

    expect(migrated['app']).toEqual({ steeringLock: 900, carLength: 5.2 });
    expect(layoutWidgets(migrated)).toEqual([
      { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
    ]);
  });

  it('falls back to the radar bar when the radar has no value', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        { id: 'proximity-radar', userSettings: {} },
        { id: 'radar-bar', userSettings: { carLength: 4.8 } },
      ])
    );

    expect(migrated['app']).toEqual({ carLength: 4.8 });
  });

  it('leaves the app default alone for a value out of range', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([{ id: 'radar-bar', userSettings: { carLength: 0 } }])
    );

    expect(migrated['app']).toBeUndefined();
  });
});

describe('v3 — the radar becomes a square scope', () => {
  it('resets the stored size and leaves the other widgets alone', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'proximity-radar',
          userSettings: { currentWidth: 200, currentHeight: 300, x: 40 },
        },
        { id: 'radar-bar', userSettings: { currentWidth: 90 } },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'proximity-radar',
        ...SQUARE_DESIGN,
        userSettings: { ...SQUARE, x: 40 },
      },
      { id: 'radar-bar', userSettings: { currentWidth: 90 } },
    ]);
  });

  it('squares the stored design size a portrait plate left behind', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'proximity-radar',
          designWidth: 200,
          designHeight: 300,
          userSettings: { currentWidth: 200, currentHeight: 300 },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
    ]);
  });

  it('reaches every layout, not just the active one', () => {
    const migrated = v3WidgetShapes.migrate({
      layouts: [
        {
          id: 'race',
          widgets: [
            {
              id: 'proximity-radar',
              userSettings: { currentWidth: 260, currentHeight: 390 },
            },
          ],
        },
        {
          id: 'garage',
          widgets: [
            {
              id: 'proximity-radar',
              userSettings: { currentWidth: 200, currentHeight: 300 },
            },
          ],
        },
      ],
    });

    expect(migrated['layouts']).toEqual([
      {
        id: 'race',
        widgets: [
          { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
        ],
      },
      {
        id: 'garage',
        widgets: [
          { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
        ],
      },
    ]);
  });
});

describe('v3WidgetShapes — pit service', () => {
  it('rebases a default-sized pit box onto the new design size', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'pit-service',
          designWidth: 300,
          designHeight: 540,
          userSettings: { currentWidth: 300, currentHeight: 540 },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 235, currentHeight: 330 },
      },
    ]);
  });

  it('keeps a widget the driver had enlarged at the same scale', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'pit-service',
          designWidth: 300,
          designHeight: 540,
          userSettings: { currentWidth: 450, currentHeight: 810 },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 353, currentHeight: 495 },
      },
    ]);
  });

  it('measures a docked rail against the old wider base, then drops the placement', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'pit-service',
          designWidth: 360,
          designHeight: 540,
          userSettings: {
            currentWidth: 360,
            currentHeight: 540,
            showPitApproach: true,
            pitApproachPlacement: 'side',
          },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: {
          currentWidth: 235,
          currentHeight: 330,
          showPitApproach: true,
        },
      },
    ]);
  });

  it('falls back to the old default when the file never stored a size', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([{ id: 'pit-service', userSettings: {} }])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 235, currentHeight: 330 },
      },
    ]);
  });

  it('rebases a Close Battle on the shipped columns, keeping its scale', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'close-battle',
          designWidth: 440,
          designHeight: 420,
          userSettings: { currentWidth: 660, currentHeight: 630 },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'close-battle',
        designWidth: 374,
        designHeight: 420,
        userSettings: { currentWidth: 561, currentHeight: 630 },
      },
    ]);
  });

  it('narrows a Close Battle whose columns were switched off, keeping its scale', () => {
    const migrated = v3WidgetShapes.migrate(
      inLayout([
        {
          id: 'close-battle',
          designWidth: 440,
          userSettings: {
            currentWidth: 880,
            showClassBadge: false,
            showDistance: false,
            showLapGap: false,
          },
        },
      ])
    );

    expect(layoutWidgets(migrated)).toEqual([
      {
        id: 'close-battle',
        designWidth: 234,
        userSettings: {
          currentWidth: 468,
          showClassBadge: false,
          showDistance: false,
          showLapGap: false,
        },
      },
    ]);
  });
});

describe('v3 — the top-level widget list is dropped', () => {
  it('drops it when the layouts already hold the widgets', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [{ id: 'pit-service', userSettings: {} }],
      ...inLayout([{ id: 'pit-service', userSettings: {} }]),
    });

    expect('widgets' in migrated).toBe(false);
    expect(migrated['defaultWidgets']).toBeUndefined();
  });

  it('keeps a layout-less driver as the template catalogue', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        {
          id: 'pit-service',
          designWidth: 300,
          designHeight: 540,
          userSettings: { currentWidth: 300, currentHeight: 540 },
        },
      ],
      layouts: [],
    });

    expect('widgets' in migrated).toBe(false);
    // Reshaped on the way across: the catalogue is what a first layout is built
    // from, so it has to arrive in the current shape like any other copy.
    expect(migrated['defaultWidgets']).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 235, currentHeight: 330 },
      },
    ]);
  });

  it('never overwrites a catalogue the driver already has', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [{ id: 'pit-service', userSettings: {} }],
      defaultWidgets: [{ id: 'radar-bar', userSettings: { currentWidth: 90 } }],
      layouts: [],
    });

    expect('widgets' in migrated).toBe(false);
    expect(migrated['defaultWidgets']).toEqual([
      { id: 'radar-bar', userSettings: { currentWidth: 90 } },
    ]);
  });
});

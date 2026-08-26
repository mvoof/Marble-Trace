import { describe, expect, it } from 'vitest';
import { v3WidgetShapes } from './v3-widget-shapes';

const SQUARE = { currentWidth: 180, currentHeight: 180 };
const SQUARE_DESIGN = { designWidth: 180, designHeight: 180 };

describe('v3 — car length to app settings', () => {
  it('lifts the value out of the radar and drops it from both copies', () => {
    const migrated = v3WidgetShapes.migrate({
      app: { steeringLock: 900 },
      widgets: [{ id: 'proximity-radar', userSettings: { carLength: 5.2 } }],
      layouts: [
        {
          id: 'race',
          widgets: [
            { id: 'proximity-radar', userSettings: { carLength: 5.2 } },
          ],
        },
      ],
    });

    expect(migrated['app']).toEqual({ steeringLock: 900, carLength: 5.2 });
    expect(migrated['widgets']).toEqual([
      { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
    ]);
    expect(migrated['layouts']).toEqual([
      {
        id: 'race',
        widgets: [
          { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
        ],
      },
    ]);
  });

  it('falls back to the radar bar when the radar has no value', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        { id: 'proximity-radar', userSettings: {} },
        { id: 'radar-bar', userSettings: { carLength: 4.8 } },
      ],
    });

    expect(migrated['app']).toEqual({ carLength: 4.8 });
  });

  it('leaves the app default alone for a value out of range', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [{ id: 'radar-bar', userSettings: { carLength: 0 } }],
    });

    expect(migrated['app']).toBeUndefined();
  });
});

describe('v3 — the radar becomes a square scope', () => {
  it('resets the stored size in every copy of the widget', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        {
          id: 'proximity-radar',
          userSettings: { currentWidth: 200, currentHeight: 300, x: 40 },
        },
        { id: 'radar-bar', userSettings: { currentWidth: 90 } },
      ],
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
      ],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'proximity-radar',
        ...SQUARE_DESIGN,
        userSettings: { ...SQUARE, x: 40 },
      },
      { id: 'radar-bar', userSettings: { currentWidth: 90 } },
    ]);
    expect(migrated['layouts']).toEqual([
      {
        id: 'race',
        widgets: [
          { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
        ],
      },
    ]);
  });

  it('squares the stored design size a portrait plate left behind', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        {
          id: 'proximity-radar',
          designWidth: 200,
          designHeight: 300,
          userSettings: { currentWidth: 200, currentHeight: 300 },
        },
      ],
    });

    expect(migrated['widgets']).toEqual([
      { id: 'proximity-radar', ...SQUARE_DESIGN, userSettings: SQUARE },
    ]);
  });
});

describe('v3WidgetShapes — pit service', () => {
  it('rebases a default-sized pit box onto the new design size', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        {
          id: 'pit-service',
          designWidth: 300,
          designHeight: 540,
          userSettings: { currentWidth: 300, currentHeight: 540 },
        },
      ],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 235, currentHeight: 330 },
      },
    ]);
  });

  it('keeps a widget the driver had enlarged at the same scale', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
        {
          id: 'pit-service',
          designWidth: 300,
          designHeight: 540,
          userSettings: { currentWidth: 450, currentHeight: 810 },
        },
      ],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 353, currentHeight: 495 },
      },
    ]);
  });

  it('measures a docked rail against the old wider base, and lands on the one width', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [
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
      ],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: {
          currentWidth: 235,
          currentHeight: 330,
          showPitApproach: true,
          pitApproachPlacement: 'side',
        },
      },
    ]);
  });

  it('falls back to the old default when the file never stored a size', () => {
    const migrated = v3WidgetShapes.migrate({
      widgets: [{ id: 'pit-service', userSettings: {} }],
    });

    expect(migrated['widgets']).toEqual([
      {
        id: 'pit-service',
        designWidth: 235,
        designHeight: 330,
        userSettings: { currentWidth: 235, currentHeight: 330 },
      },
    ]);
  });
});

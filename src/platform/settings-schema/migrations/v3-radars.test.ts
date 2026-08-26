import { describe, expect, it } from 'vitest';
import { v3Radars } from './v3-radars';

const SQUARE = { currentWidth: 180, currentHeight: 180 };
const SQUARE_DESIGN = { designWidth: 180, designHeight: 180 };

describe('v3 — car length to app settings', () => {
  it('lifts the value out of the radar and drops it from both copies', () => {
    const migrated = v3Radars.migrate({
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
    const migrated = v3Radars.migrate({
      widgets: [
        { id: 'proximity-radar', userSettings: {} },
        { id: 'radar-bar', userSettings: { carLength: 4.8 } },
      ],
    });

    expect(migrated['app']).toEqual({ carLength: 4.8 });
  });

  it('leaves the app default alone for a value out of range', () => {
    const migrated = v3Radars.migrate({
      widgets: [{ id: 'radar-bar', userSettings: { carLength: 0 } }],
    });

    expect(migrated['app']).toBeUndefined();
  });
});

describe('v3 — the radar becomes a square scope', () => {
  it('resets the stored size in every copy of the widget', () => {
    const migrated = v3Radars.migrate({
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
    const migrated = v3Radars.migrate({
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

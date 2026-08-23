import { describe, expect, it } from 'vitest';
import { v3CarLengthToApp } from './v3-car-length-to-app';

describe('v3 — car length to app settings', () => {
  it('lifts the value out of the radar and drops it from both copies', () => {
    const migrated = v3CarLengthToApp.migrate({
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
      { id: 'proximity-radar', userSettings: {} },
    ]);
    expect(migrated['layouts']).toEqual([
      { id: 'race', widgets: [{ id: 'proximity-radar', userSettings: {} }] },
    ]);
  });

  it('falls back to the radar bar when the radar has no value', () => {
    const migrated = v3CarLengthToApp.migrate({
      widgets: [
        { id: 'proximity-radar', userSettings: {} },
        { id: 'radar-bar', userSettings: { carLength: 4.8 } },
      ],
    });

    expect(migrated['app']).toEqual({ carLength: 4.8 });
  });

  it('leaves the app default alone for a value out of range', () => {
    const migrated = v3CarLengthToApp.migrate({
      widgets: [{ id: 'radar-bar', userSettings: { carLength: 0 } }],
    });

    expect(migrated['app']).toBeUndefined();
  });
});

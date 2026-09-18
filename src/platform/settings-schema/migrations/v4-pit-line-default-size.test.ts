import { describe, expect, it } from 'vitest';
import { v4PitLineDefaultSize } from './v4-pit-line-default-size';

const pitLine = (userSettings: Record<string, unknown>) => ({
  id: 'pit-line',
  userSettings,
});

describe('v4 — the pit line ships as a tall strip', () => {
  it('rebases a widget still sitting on the old default', () => {
    const migrated = v4PitLineDefaultSize.migrate({
      defaultWidgets: [pitLine({ currentWidth: 120, currentHeight: 150 })],
      layouts: [
        {
          id: 'race',
          widgets: [pitLine({ currentWidth: 120, currentHeight: 150, x: 40 })],
        },
      ],
    });

    const catalogue = migrated['defaultWidgets'] as Array<{
      userSettings: Record<string, unknown>;
    }>;
    const layout = (
      migrated['layouts'] as Array<{
        widgets: Array<{ userSettings: Record<string, unknown> }>;
      }>
    )[0];

    expect(catalogue[0]?.userSettings).toEqual({
      currentWidth: 80,
      currentHeight: 380,
    });
    // The position the driver dragged it to is theirs, and only the size moves.
    expect(layout?.widgets[0]?.userSettings).toEqual({
      currentWidth: 80,
      currentHeight: 380,
      x: 40,
    });
  });

  it('leaves a size the driver chose alone', () => {
    const chosen = pitLine({ currentWidth: 240, currentHeight: 300 });
    const blob = { layouts: [{ id: 'race', widgets: [chosen] }] };

    expect(v4PitLineDefaultSize.migrate(blob)).toEqual(blob);
  });

  it('leaves a widget that is only half on the old default alone', () => {
    const half = pitLine({ currentWidth: 120, currentHeight: 420 });
    const blob = { defaultWidgets: [half] };

    expect(v4PitLineDefaultSize.migrate(blob)).toEqual(blob);
  });

  it('touches no other widget', () => {
    const blob = {
      defaultWidgets: [
        {
          id: 'pit-service',
          userSettings: { currentWidth: 120, currentHeight: 150 },
        },
      ],
    };

    expect(v4PitLineDefaultSize.migrate(blob)).toEqual(blob);
  });

  it('leaves a copy of the pit line on the same footing as the original', () => {
    const migrated = v4PitLineDefaultSize.migrate({
      defaultWidgets: [
        {
          id: 'pit-line-2',
          type: 'pit-line',
          userSettings: { currentWidth: 120, currentHeight: 150 },
        },
      ],
    });

    const copy = (
      migrated['defaultWidgets'] as Array<{
        userSettings: Record<string, unknown>;
      }>
    )[0];

    expect(copy?.userSettings).toEqual({
      currentWidth: 80,
      currentHeight: 380,
    });
  });
});

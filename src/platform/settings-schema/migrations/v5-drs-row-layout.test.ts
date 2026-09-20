import { describe, expect, it } from 'vitest';
import { v5DrsRowLayout } from './v5-drs-row-layout';

const drs = (
  userSettings: Record<string, unknown>,
  design: Record<string, unknown> = { designWidth: 136, designHeight: 46 }
) => ({
  id: 'drs',
  ...design,
  userSettings,
});

describe('v5 — the DRS plate lays out as a row', () => {
  it('rebases both the design size and a box still on the old default', () => {
    const migrated = v5DrsRowLayout.migrate({
      defaultWidgets: [drs({ currentWidth: 136, currentHeight: 46 })],
      layouts: [
        {
          id: 'race',
          widgets: [drs({ currentWidth: 136, currentHeight: 46, x: 700 })],
        },
      ],
    });

    const catalogue = migrated['defaultWidgets'] as Array<
      Record<string, unknown>
    >;
    const layout = (
      migrated['layouts'] as Array<{
        widgets: Array<Record<string, unknown>>;
      }>
    )[0];

    expect(catalogue[0]).toMatchObject({
      designWidth: 215,
      designHeight: 56,
      userSettings: { currentWidth: 215, currentHeight: 56 },
    });
    // The position the driver dragged it to is theirs, and only the size moves.
    expect(layout?.widgets[0]).toMatchObject({
      designWidth: 215,
      designHeight: 56,
      userSettings: { currentWidth: 215, currentHeight: 56, x: 700 },
    });
  });

  // The design size is build data, so it moves even when the driver has picked
  // a box of their own — leaving it behind is what overflows the plate.
  it('moves the design size while leaving a size the driver chose alone', () => {
    const migrated = v5DrsRowLayout.migrate({
      defaultWidgets: [drs({ currentWidth: 300, currentHeight: 90 })],
    });

    expect(
      (migrated['defaultWidgets'] as Array<Record<string, unknown>>)[0]
    ).toMatchObject({
      designWidth: 215,
      designHeight: 56,
      userSettings: { currentWidth: 300, currentHeight: 90 },
    });
  });

  it('leaves a box that is only half on the old default alone', () => {
    const migrated = v5DrsRowLayout.migrate({
      defaultWidgets: [drs({ currentWidth: 136, currentHeight: 51 })],
    });

    expect(
      (migrated['defaultWidgets'] as Array<Record<string, unknown>>)[0]
    ).toMatchObject({
      designWidth: 215,
      userSettings: { currentWidth: 136, currentHeight: 51 },
    });
  });

  it('leaves a file already on the new design untouched', () => {
    const blob = {
      defaultWidgets: [
        drs(
          { currentWidth: 215, currentHeight: 56 },
          { designWidth: 215, designHeight: 56 }
        ),
      ],
    };

    expect(v5DrsRowLayout.migrate(blob)).toEqual(blob);
  });

  it('touches no other widget', () => {
    const blob = {
      defaultWidgets: [
        {
          id: 'pit-line',
          designWidth: 136,
          designHeight: 46,
          userSettings: { currentWidth: 136, currentHeight: 46 },
        },
      ],
    };

    expect(v5DrsRowLayout.migrate(blob)).toEqual(blob);
  });

  it('leaves a copy of the DRS plate on the same footing as the original', () => {
    const migrated = v5DrsRowLayout.migrate({
      defaultWidgets: [
        {
          id: 'drs-2',
          type: 'drs',
          designWidth: 136,
          designHeight: 46,
          userSettings: { currentWidth: 136, currentHeight: 46 },
        },
      ],
    });

    expect(
      (migrated['defaultWidgets'] as Array<Record<string, unknown>>)[0]
    ).toMatchObject({
      designWidth: 215,
      designHeight: 56,
      userSettings: { currentWidth: 215, currentHeight: 56 },
    });
  });
});

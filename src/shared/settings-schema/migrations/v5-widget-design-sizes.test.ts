import { describe, expect, it } from 'vitest';
import { v5WidgetDesignSizes } from './v5-widget-design-sizes';

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
    const migrated = v5WidgetDesignSizes.migrate({
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
    const migrated = v5WidgetDesignSizes.migrate({
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
    const migrated = v5WidgetDesignSizes.migrate({
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

    expect(v5WidgetDesignSizes.migrate(blob)).toEqual(blob);
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

    expect(v5WidgetDesignSizes.migrate(blob)).toEqual(blob);
  });

  it('leaves a copy of the DRS plate on the same footing as the original', () => {
    const migrated = v5WidgetDesignSizes.migrate({
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

const enginePanel = (
  userSettings: Record<string, unknown>,
  design: Record<string, unknown> = { designWidth: 500, designHeight: 65 }
) => ({
  id: 'engine-panel',
  ...design,
  userSettings,
});

describe('v5 — the engine panel groups its cells into plates', () => {
  it('rebases the design size, the untouched box and the shipped ceilings', () => {
    const migrated = v5WidgetDesignSizes.migrate({
      defaultWidgets: [
        enginePanel({
          currentWidth: 500,
          currentHeight: 65,
          horizontalColumns: 8,
          verticalColumns: 2,
        }),
      ],
    });

    const [widget] = migrated['defaultWidgets'] as Array<
      Record<string, unknown>
    >;

    expect(widget['designWidth']).toBe(687.5);
    expect(widget['designHeight']).toBe(124);
    expect(widget['userSettings']).toMatchObject({
      currentWidth: 687.5,
      currentHeight: 124,
      horizontalColumns: 12,
      verticalColumns: 3,
    });
  });

  it('leaves a box and a ceiling the driver chose alone', () => {
    const migrated = v5WidgetDesignSizes.migrate({
      defaultWidgets: [
        enginePanel({
          currentWidth: 720,
          currentHeight: 65,
          horizontalColumns: 4,
        }),
      ],
    });

    const [widget] = migrated['defaultWidgets'] as Array<
      Record<string, unknown>
    >;

    // The design size is build data and moves regardless; the box and the
    // ceiling are the driver's and do not.
    expect(widget['designWidth']).toBe(687.5);
    expect(widget['userSettings']).toMatchObject({
      currentWidth: 720,
      currentHeight: 65,
      horizontalColumns: 4,
    });
  });

  it('moves a ceiling still on its default under a widget that was resized', () => {
    const migrated = v5WidgetDesignSizes.migrate({
      defaultWidgets: [
        enginePanel({
          currentWidth: 900,
          currentHeight: 120,
          horizontalColumns: 8,
        }),
      ],
    });

    const [widget] = migrated['defaultWidgets'] as Array<
      Record<string, unknown>
    >;

    expect(widget['userSettings']).toMatchObject({
      currentWidth: 900,
      horizontalColumns: 12,
    });
  });

  it('reaches a copy on a layout, which names its type', () => {
    const migrated = v5WidgetDesignSizes.migrate({
      layouts: [
        {
          id: 'race',
          widgets: [
            {
              id: 'engine-panel-2',
              type: 'engine-panel',
              designWidth: 500,
              designHeight: 65,
              userSettings: { currentWidth: 500, currentHeight: 65 },
            },
          ],
        },
      ],
    });

    const [widget] = (
      migrated['layouts'] as Array<{ widgets: Array<Record<string, unknown>> }>
    )[0].widgets;

    expect(widget['designWidth']).toBe(687.5);
    expect(widget['userSettings']).toMatchObject({ currentWidth: 687.5 });
  });
});

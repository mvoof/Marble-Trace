import { describe, expect, it } from 'vitest';
import { observable } from 'mobx';

import { WidgetAutoHideStore } from './widget-auto-hide.store';
import type { DrsState } from '@/types/bindings';
import type { DrsWidgetSettings } from '@/types/widget-settings';

type Deps = ConstructorParameters<typeof WidgetAutoHideStore>[0];

const drsStore = (
  drs: DrsState | null,
  settings: Partial<DrsWidgetSettings> = {}
) =>
  new WidgetAutoHideStore({
    liveWidgets: {
      getWidget: () => ({ id: 'drs' }),
      getSettings: () => ({
        hideWhenUnavailable: false,
        hideWhenCarHasNoDrs: true,
        ...settings,
      }),
    },
    player: observable({ carStatus: { drs } }),
  } as unknown as Deps);

// The container draws its plate around a body that renders nothing, so a widget
// that answers "no DRS" by returning null still leaves an empty box on screen.
// The answer has to come from here.
describe('WidgetAutoHideStore — DRS', () => {
  it('takes the widget off a car that has no DRS at all', () => {
    expect(drsStore(null).isVisible('drs')).toBe(false);
  });

  it('keeps it there when the driver asked for the plate', () => {
    expect(
      drsStore(null, { hideWhenCarHasNoDrs: false }).isVisible('drs')
    ).toBe(true);
  });

  it('keeps it on a car that has DRS but cannot use it yet', () => {
    expect(drsStore('Unavailable').isVisible('drs')).toBe(true);
  });

  it('hides that state only when asked separately', () => {
    expect(
      drsStore('Unavailable', { hideWhenUnavailable: true }).isVisible('drs')
    ).toBe(false);
  });

  it('never hides an open wing, whatever either switch says', () => {
    expect(
      drsStore('Open', {
        hideWhenUnavailable: true,
        hideWhenCarHasNoDrs: true,
      }).isVisible('drs')
    ).toBe(true);
  });
});

describe('WidgetAutoHideStore — wheel to wheel', () => {
  const wheelToWheelStore = (isVisible: boolean) =>
    new WidgetAutoHideStore({
      liveWidgets: { getWidget: () => ({ id: 'wheel-to-wheel' }) },
      wheelToWheelWidget: { isVisible },
    } as unknown as Deps);

  it('takes the plate off while nobody is inside the threshold', () => {
    expect(wheelToWheelStore(false).isVisible('wheel-to-wheel')).toBe(false);
  });

  it('puts it back when a rival is', () => {
    expect(wheelToWheelStore(true).isVisible('wheel-to-wheel')).toBe(true);
  });
});

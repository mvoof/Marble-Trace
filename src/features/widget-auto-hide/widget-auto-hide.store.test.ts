import { describe, expect, it } from 'vitest';
import { observable } from 'mobx';

import {
  WidgetAutoHideStore,
  type DrsVisibilitySettings,
} from './widget-auto-hide.store';
import type { DrsState } from '@shared/contracts/generated/bindings';

type Deps = ConstructorParameters<typeof WidgetAutoHideStore>[0];

const drsStore = (
  drs: DrsState | null,
  settings: Partial<DrsVisibilitySettings> = {}
) =>
  new WidgetAutoHideStore({
    liveWidgets: {
      getWidget: () => ({ id: 'drs', type: 'drs' }),
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
  const wheelToWheelStore = (visibleByInstance: Record<string, boolean>) =>
    new WidgetAutoHideStore({
      liveWidgets: {
        getWidget: (instanceId: string) => ({
          id: instanceId,
          type: 'wheel-to-wheel',
        }),
      },
      widgetInstances: {
        storeOf: (instanceId: string) =>
          instanceId in visibleByInstance
            ? { isVisible: visibleByInstance[instanceId] }
            : null,
      },
    } as unknown as Deps);

  it('takes the plate off while nobody is inside the threshold', () => {
    expect(
      wheelToWheelStore({ 'wheel-to-wheel': false }).isVisible('wheel-to-wheel')
    ).toBe(false);
  });

  it('puts it back when a rival is', () => {
    expect(
      wheelToWheelStore({ 'wheel-to-wheel': true }).isVisible('wheel-to-wheel')
    ).toBe(true);
  });

  it('answers each plate from its own instance', () => {
    const store = wheelToWheelStore({
      'wheel-to-wheel': true,
      'wheel-to-wheel-2': false,
    });

    expect(store.isVisible('wheel-to-wheel')).toBe(true);
    expect(store.isVisible('wheel-to-wheel-2')).toBe(false);
  });

  it('keeps an instance that is not mounted off screen', () => {
    expect(wheelToWheelStore({}).isVisible('wheel-to-wheel')).toBe(false);
  });
});

const absStore = (dcAbs: number | null, hideWhenCarHasNoAbs = true) =>
  new WidgetAutoHideStore({
    liveWidgets: {
      getWidget: () => ({ id: 'abs', type: 'abs' }),
      getSettings: () => ({ hideWhenCarHasNoAbs }),
    },
    player: observable({ carStatus: { dc_abs: dcAbs } }),
  } as unknown as Deps);

describe('WidgetAutoHideStore — ABS', () => {
  it('takes the widget off a car with no ABS adjustment', () => {
    expect(absStore(null).isVisible('abs')).toBe(false);
  });

  it('keeps it there when the driver asked for the plate', () => {
    expect(absStore(null, false).isVisible('abs')).toBe(true);
  });

  it('shows it on a car with a level, even at zero', () => {
    expect(absStore(0).isVisible('abs')).toBe(true);
  });
});

const radioStore = (radioTransmission: object | null) =>
  new WidgetAutoHideStore({
    liveWidgets: {
      getWidget: () => ({ id: 'radio', type: 'radio' }),
    },
    cars: observable({ radioTransmission }),
  } as unknown as Deps);

describe('WidgetAutoHideStore — radio', () => {
  it('takes the widget off while nobody is talking', () => {
    expect(radioStore(null).isVisible('radio')).toBe(false);
  });

  it('shows it for a transmission', () => {
    expect(
      radioStore({ carIdx: 4, radioNum: 0, frequencyNum: 2 }).isVisible('radio')
    ).toBe(true);
  });
});

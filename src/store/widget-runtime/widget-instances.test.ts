import { describe, it, expect, vi } from 'vitest';

import {
  SharedWidgetStores,
  WidgetInstanceRegistry,
  type WidgetInstanceContext,
} from './widget-instances';

const fakeStartable = () => ({ init: vi.fn(), dispose: vi.fn() });

const fakeStores = () => ({
  flags: fakeStartable(),
  paceCar: fakeStartable(),
  radar: fakeStartable(),
});

const contextFor = (instanceId: string, type: string) =>
  ({ core: {}, instanceId, type }) as unknown as WidgetInstanceContext;

describe('SharedWidgetStores', () => {
  it('starts on the first consumer and stops on the last', () => {
    const stores = fakeStores();
    const shared = new SharedWidgetStores(stores, true);

    shared.acquire('flags');
    shared.acquire('flags');

    expect(stores.flags.init).toHaveBeenCalledTimes(1);

    shared.release('flags');

    expect(stores.flags.dispose).not.toHaveBeenCalled();
    expect(shared.isRunning('flags')).toBe(true);

    shared.release('flags');

    expect(stores.flags.dispose).toHaveBeenCalledTimes(1);
    expect(shared.isRunning('flags')).toBe(false);
  });

  it('starts again after the last consumer left', () => {
    const stores = fakeStores();
    const shared = new SharedWidgetStores(stores, true);

    shared.acquire('radar');
    shared.release('radar');
    shared.acquire('radar');

    expect(stores.radar.init).toHaveBeenCalledTimes(2);
  });

  it('ignores a release nobody acquired', () => {
    const stores = fakeStores();
    const shared = new SharedWidgetStores(stores, true);

    shared.release('paceCar');

    expect(stores.paceCar.dispose).not.toHaveBeenCalled();
  });

  it('starts nothing in a core that does not start stores', () => {
    const stores = fakeStores();
    const shared = new SharedWidgetStores(stores, false);

    shared.acquire('flags');
    shared.release('flags');

    expect(stores.flags.init).not.toHaveBeenCalled();
    expect(stores.flags.dispose).not.toHaveBeenCalled();
  });
});

describe('WidgetInstanceRegistry', () => {
  it('holds a store only between open and close', () => {
    const registry = new WidgetInstanceRegistry(() => true);
    const store = { dispose: vi.fn() };

    registry.open(contextFor('standings', 'standings'), () => store);

    expect(registry.storesOf('standings')).toEqual([store]);

    registry.close('standings', store);

    expect(store.dispose).toHaveBeenCalledTimes(1);
    expect(registry.storesOf('standings')).toEqual([]);
  });

  it('keeps the newer store when the older one closes late', () => {
    const registry = new WidgetInstanceRegistry(() => true);
    const older = { dispose: vi.fn() };
    const newer = { dispose: vi.fn() };

    registry.open(contextFor('standings', 'standings'), () => older);
    registry.open(contextFor('standings', 'standings'), () => newer);
    registry.close('standings', older);

    expect(older.dispose).toHaveBeenCalledTimes(1);
    expect(registry.storesOf('standings')).toEqual([newer]);
  });

  it('reaches only the instances marked for hotkeys', () => {
    const registry = new WidgetInstanceRegistry(
      (instanceId) => instanceId !== 'standings-copy'
    );
    const marked = { dispose: vi.fn() };
    const unmarked = { dispose: vi.fn() };

    registry.open(contextFor('standings', 'standings'), () => marked);
    registry.open(contextFor('standings-copy', 'standings'), () => unmarked);

    expect(registry.hotkeyStoresOf('standings')).toEqual([marked]);
    expect(registry.storesOf('standings')).toEqual([marked, unmarked]);
  });
});

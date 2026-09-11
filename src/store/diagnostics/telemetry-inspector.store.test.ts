import { beforeEach, describe, expect, it, vi } from 'vitest';

const setInspectorActive = vi.fn(async (_active: boolean) => undefined);
const getInspectorFrame = vi.fn(async () => null as unknown);
const getDeliveryCounters = vi.fn(async () => [] as unknown);
const resetDeliveryCounters = vi.fn(async () => undefined);

vi.mock('@platform/services/telemetry.service', () => ({
  setInspectorActive: (active: boolean) => setInspectorActive(active),
  getInspectorFrame: () => getInspectorFrame(),
  getDeliveryCounters: () => getDeliveryCounters(),
  resetDeliveryCounters: () => resetDeliveryCounters(),
}));

const { TelemetryInspectorStore } = await import('./telemetry-inspector.store');

/** Only the two things the store reads off the root. */
const makeRoot = (sessionInfo: unknown = null) =>
  ({ session: { sessionInfo } }) as never;

const makeStore = (sessionInfo: unknown = null) =>
  new TelemetryInspectorStore(makeRoot(sessionInfo));

const frame = {
  car_dynamics: { speed: 42.123456, gear: 3 },
  car_idx: { car_idx_lap_dist_pct: [0.1, 0.2], spotter: null },
};

describe('TelemetryInspectorStore', () => {
  beforeEach(() => {
    setInspectorActive.mockClear();
    getInspectorFrame.mockClear();
    getInspectorFrame.mockResolvedValue(null);
    getDeliveryCounters.mockClear();
    resetDeliveryCounters.mockClear();
    getDeliveryCounters.mockResolvedValue([]);
  });

  // The whole reason this store pulls instead of subscribing: the settings
  // window must stay off the telemetry bundle, and the backend must keep
  // nothing while nobody is looking.
  it('opens the feed on start and closes it on stop', async () => {
    const store = makeStore();

    await store.start();
    expect(setInspectorActive).toHaveBeenCalledWith(true);
    expect(store.running).toBe(true);

    await store.stop();
    expect(setInspectorActive).toHaveBeenCalledWith(false);
    expect(store.running).toBe(false);
  });

  it('stays closed and reports the failure when the backend refuses', async () => {
    setInspectorActive.mockRejectedValueOnce(new Error('no such command'));

    const store = makeStore();
    await store.start();

    expect(store.running).toBe(false);
    expect(store.lastError).toContain('no such command');
  });

  it('drops the frame when the feed closes, so a stale tick cannot be read', async () => {
    const store = makeStore();

    await store.start();
    store.frame = frame as never;

    await store.stop();

    expect(store.frame).toBeNull();
  });

  it('builds its rows from the pulled frame', () => {
    const store = makeStore();
    store.frame = frame as never;

    expect(store.rows.map((row) => row.path)).toEqual([
      'car_dynamics',
      'car_idx',
    ]);
  });

  it('counts what the sim does not report', () => {
    const store = makeStore();
    store.frame = frame as never;

    expect(store.absentCount).toBe(1);
  });

  it('opens and closes a branch', () => {
    const store = makeStore();
    store.frame = frame as never;

    store.toggleExpanded('car_dynamics');
    expect(store.rows.map((row) => row.path)).toContain('car_dynamics.speed');

    store.toggleExpanded('car_dynamics');
    expect(store.rows.map((row) => row.path)).not.toContain(
      'car_dynamics.speed'
    );
  });

  // The session snapshot arrives on its own event, which this window already
  // receives — keeping the backend filling telemetry frames nobody reads would
  // be exactly the waste this design exists to avoid.
  it('reads the session from the store and shuts the feed down for it', async () => {
    const store = makeStore({ trackId: 18, cars: [] });

    await store.start();
    expect(store.running).toBe(true);

    await store.setSource('session');

    expect(store.running).toBe(false);
    expect(store.rows.map((row) => row.path)).toEqual(['trackId', 'cars']);
  });

  it('reopens the feed when switching back to telemetry', async () => {
    const store = makeStore({ trackId: 18 });

    await store.setSource('session');
    setInspectorActive.mockClear();

    await store.setSource('telemetry');

    expect(setInspectorActive).toHaveBeenCalledWith(true);
    expect(store.running).toBe(true);

    await store.stop();
  });

  it('forgets what was open when the source changes', async () => {
    const store = makeStore({ trackId: 18 });
    store.frame = frame as never;
    store.toggleExpanded('car_dynamics');

    await store.setSource('session');
    await store.setSource('telemetry');

    expect(store.rows.map((row) => row.path)).not.toContain(
      'car_dynamics.speed'
    );

    await store.stop();
  });

  it('reuses the open feed for a one-shot capture instead of cycling it', async () => {
    const store = makeStore();

    await store.start();
    store.frame = frame as never;
    setInspectorActive.mockClear();

    await expect(store.captureOnce()).resolves.toBe(store.frame);
    expect(setInspectorActive).not.toHaveBeenCalled();

    await store.stop();
  });

  it('opens and closes the feed again for a capture taken while closed', async () => {
    getInspectorFrame.mockResolvedValue(frame);

    const store = makeStore();
    const captured = await store.captureOnce();

    expect(captured).toEqual(frame);
    expect(setInspectorActive).toHaveBeenNthCalledWith(1, true);
    expect(setInspectorActive).toHaveBeenLastCalledWith(false);
    expect(store.running).toBe(false);
  });

  // The snapshot export must produce a telemetry frame even when the panel
  // happens to be showing the session — and must leave it showing the session.
  it('captures a frame while the session is on screen, then restores it', async () => {
    getInspectorFrame.mockResolvedValue(frame);

    const store = makeStore({ trackId: 18 });
    await store.setSource('session');

    await expect(store.captureOnce()).resolves.toEqual(frame);

    expect(store.source).toBe('session');
    expect(store.running).toBe(false);
  });

  // The counters are read as a rate, not as a total: "this window took
  // carPositions 60 times a second" is the claim tickets 02-04 are checked
  // against, and a total alone cannot say it.
  it('derives an effective rate per label and per field', async () => {
    getDeliveryCounters.mockResolvedValue([
      {
        label: 'broadcast',
        elapsedMs: 2000,
        bundles: 120,
        fields: [
          { field: 'carPositions', bundles: 120 },
          { field: 'proximity', bundles: 0 },
        ],
      },
    ]);

    const store = makeStore();
    await store.refreshDeliveryCounters();

    const [row] = store.deliveryRows;

    expect(row.label).toBe('broadcast');
    expect(row.hz).toBeCloseTo(60);
    expect(row.fields[0]).toEqual({
      field: 'carPositions',
      bundles: 120,
      hz: 60,
    });
    expect(row.fields[1].hz).toBe(0);
  });

  // A set whose span is zero has not measured anything yet; dividing by it
  // would report an infinite rate on the first poll after a reset.
  it('reports no rate for a span that has not started', async () => {
    getDeliveryCounters.mockResolvedValue([
      { label: 'broadcast', elapsedMs: 0, bundles: 0, fields: [] },
    ]);

    const store = makeStore();
    await store.refreshDeliveryCounters();

    expect(store.deliveryRows[0].hz).toBe(0);
  });
});

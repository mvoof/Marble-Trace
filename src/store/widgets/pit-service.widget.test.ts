import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runInAction } from 'mobx';
import { RootStore } from '../root-store';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

// RootStore subscribes to sim events on construction; the node test
// environment has no window for the Tauri event bridge to attach to.
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}));

describe('PitServiceWidgetStore — pit orders', () => {
  let rootStore: RootStore;

  // `enabled` comes from BaseUserSettings rather than the widget's own settings,
  // but auto mode depends on it, so the helper takes both.
  const setSettings = (
    partial: Partial<PitServiceWidgetSettings> & { enabled?: boolean }
  ) => {
    runInAction(() => {
      const settings =
        rootStore.widgetSettings.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        );

      rootStore.widgetSettings.updateUserSettings('pit-service', {
        ...settings,
        ...partial,
      });
    });
  };

  const setFuelPlan = (toAdd: number | null, tankMax: number | null) => {
    runInAction(() => {
      rootStore.backendComputed.fuel = {
        fuelToAddWithBuffer: toAdd,
      } as never;

      rootStore.session.sessionInfo = {
        driverCarFuelMaxLtr: tankMax,
      } as never;
    });
  };

  // The store shares the invoke mock with everything else RootStore does, so
  // "how many orders went out" has to ignore the rest of the traffic.
  const pitOrderCalls = () =>
    invokeMock.mock.calls.filter(([command]) => command === 'send_pit_order');

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    rootStore = new RootStore();
  });

  it('caps the planned fuel at tank capacity', () => {
    setFuelPlan(120, 106);

    expect(rootStore.pitServiceWidget.plannedFuelLiters).toBe(106);
  });

  it('rounds fuel up so the order never lands a liter short', () => {
    setFuelPlan(25.2, 106);

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'fuel', value: 26 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
      { kind: 'lr', value: 0 },
      { kind: 'rr', value: 0 },
    ]);
  });

  it('omits fuel entirely when none is needed', () => {
    setFuelPlan(null, 106);

    expect(rootStore.pitServiceWidget.plannedOrder).toEqual([
      { kind: 'clear', value: 0 },
      { kind: 'lf', value: 0 },
      { kind: 'rf', value: 0 },
      { kind: 'lr', value: 0 },
      { kind: 'rr', value: 0 },
    ]);
  });

  it('invokes the backend with the planned order', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.sendPlannedOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [
        { kind: 'clear', value: 0 },
        { kind: 'fuel', value: 30 },
        { kind: 'lf', value: 0 },
        { kind: 'rf', value: 0 },
        { kind: 'lr', value: 0 },
        { kind: 'rr', value: 0 },
      ],
    });
    expect(rootStore.pitServiceWidget.lastOrderResult).toBe('sent');
  });

  it('reports a failed order instead of throwing', async () => {
    setFuelPlan(30, 106);
    invokeMock.mockRejectedValue(new Error('no broadcast message'));

    await rootStore.pitServiceWidget.sendPlannedOrder();

    expect(rootStore.pitServiceWidget.lastOrderResult).toBe('failed');
  });

  const setPitService = (partial: Record<string, unknown>) => {
    runInAction(() => {
      rootStore.player.pitService = {
        changeLf: false,
        changeRf: false,
        changeLr: false,
        changeRr: false,
        addFuel: false,
        fastRepair: false,
        cleanWindshield: false,
        ...partial,
      } as never;
    });
  };

  it('steps the ordered fuel up from what the sim currently holds', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 40 });

    await rootStore.pitServiceWidget.adjustFuel(
      rootStore.pitServiceWidget.fuelStepLiters
    );

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'fuel', value: 41 }],
    });
  });

  it('caps a manual fuel change at tank capacity', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.setFuelLiters(200);

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'fuel', value: 106 }],
    });
  });

  it('clears fuel instead of ordering zero liters', async () => {
    setFuelPlan(30, 106);

    await rootStore.pitServiceWidget.setFuelLiters(0);

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
  });

  it('holds the drag in a draft and sends it once on release', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fuelAmount: 10 });

    rootStore.pitServiceWidget.setFuelDraft(50);
    rootStore.pitServiceWidget.setFuelDraft(64);

    expect(rootStore.pitServiceWidget.fuelDisplayLiters).toBe(64);
    expect(invokeMock).not.toHaveBeenCalledWith(
      'send_pit_order',
      expect.anything()
    );

    await rootStore.pitServiceWidget.commitFuelDraft();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'fuel', value: 64 }],
    });
    expect(rootStore.pitServiceWidget.fuelDraftLiters).toBeNull();
  });

  it('checks a single corner without touching the rest of the order', async () => {
    setPitService({ changeRf: true });

    await rootStore.pitServiceWidget.toggleTire('lf');

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'lf', value: 0 }],
    });
  });

  it('unchecks one corner by clearing all four and restoring the others', async () => {
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      rfPressure: 165,
      lrPressure: null,
    });

    await rootStore.pitServiceWidget.toggleTire('lf');

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [
        { kind: 'clearTires', value: 0 },
        { kind: 'rf', value: 165 },
        { kind: 'lr', value: 0 },
      ],
    });
  });

  it('clears the tires only when all four are already ordered', async () => {
    setPitService({
      changeLf: true,
      changeRf: true,
      changeLr: true,
      changeRr: true,
    });

    await rootStore.pitServiceWidget.toggleAllTires();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearTires', value: 0 }],
    });
  });

  it('sends the clear variant when a box is already checked', async () => {
    setFuelPlan(30, 106);
    setPitService({ addFuel: true, fastRepair: true, cleanWindshield: false });

    await rootStore.pitServiceWidget.toggleFuel();
    await rootStore.pitServiceWidget.toggleFastRepair();
    await rootStore.pitServiceWidget.toggleWindshield();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearFuel', value: 0 }],
    });
    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clearFastRepair', value: 0 }],
    });
    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'windshield', value: 0 }],
    });
  });

  const setTireWear = (wearByCorner: Record<string, number>) => {
    runInAction(() => {
      const chassis: Record<string, number> = {};

      for (const [corner, wear] of Object.entries(wearByCorner)) {
        chassis[`${corner}_wear_l`] = wear;
        chassis[`${corner}_wear_m`] = wear;
        chassis[`${corner}_wear_r`] = wear;
      }

      rootStore.player.chassis = chassis as never;
    });
  };

  describe('auto mode', () => {
    // `enabled` matters as much as the auto switches: auto mode is inert for a
    // widget that is not in the active layout.
    const enableAuto = () =>
      setSettings({
        enabled: true,
        autoFuel: true,
        autoTires: true,
        autoTireWearThreshold: 60,
      });

    it('orders only the corners worn past the threshold', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.55, rf: 0.62, lr: 0.9, rr: 0.6 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
          { kind: 'rr', value: 0 },
        ],
      });
    });

    // The whole point of the split: on pit road the sim still reports the
    // previous stop's tread, and only the reading taken in the box may decide
    // the order.
    it('orders tires from the wear read in the box, not on pit entry', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(invokeMock).not.toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });

      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    // "Change nothing" is a decision auto mode has to enforce: the sim arms the
    // box with the previous stop's order by itself, so staying silent would
    // leave four tires ordered that the threshold said to keep.
    it('clears the tires when no corner is worn enough to change', async () => {
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'clearTires', value: 0 }],
      });
    });

    // The fuel half runs before any tire wear is readable, so it must not touch
    // the tire side of the order the sim has armed.
    it('leaves the tires alone on pit entry', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(pitOrderCalls()).toHaveLength(1);
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    it('sends each half once per stop', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      invokeMock.mockClear();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    it('takes the worst of the three points across the tread', () => {
      enableAuto();
      runInAction(() => {
        rootStore.player.chassis = {
          lf_wear_l: 0.4,
          lf_wear_m: 0.95,
          lf_wear_r: 0.95,
        } as never;
      });

      expect(rootStore.pitServiceWidget.autoTireCorners).toEqual(['lf']);
    });

    it('leaves out a section the driver switched off', async () => {
      setFuelPlan(30, 106);
      enableAuto();
      setSettings({ autoFuel: false });
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderCalls()).toHaveLength(1);
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    it('marks the wear as stale everywhere but in the box', () => {
      enableAuto();
      setTireWear({ lf: 0.3 });

      expect(rootStore.pitServiceWidget.isTireWearStale).toBe(true);

      setPitService({ inPitStall: true });

      expect(rootStore.pitServiceWidget.isTireWearStale).toBe(false);
    });

    it('stands down for the rest of the stop after a manual change', async () => {
      setFuelPlan(30, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.toggleWindshield();

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(false);

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });

    // Correcting the fuel is the most ordinary thing a driver does on the way
    // in, and it says nothing at all about the tires.
    it('claims only the fuel half when the fuel is nudged by hand', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setPitService({ addFuel: true, fuelAmount: 40 });
      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.adjustFuel(
        rootStore.pitServiceWidget.fuelStepLiters
      );

      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(false);
      expect(rootStore.pitServiceWidget.isAutoTiresPending).toBe(true);

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderCalls()).toHaveLength(1);
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearTires', value: 0 },
          { kind: 'lf', value: 0 },
        ],
      });
    });

    it('claims only the tire half when a corner is toggled by hand', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.3 });

      await rootStore.pitServiceWidget.toggleTire('rf');

      expect(rootStore.pitServiceWidget.isAutoTiresPending).toBe(false);
      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(true);

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(pitOrderCalls()).toHaveLength(1);
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clearFuel', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
    });

    it('gives the fuel half back when the calculated amount is ordered', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setPitService({ addFuel: true, fuelAmount: 40 });

      await rootStore.pitServiceWidget.adjustFuel(
        rootStore.pitServiceWidget.fuelStepLiters
      );

      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(false);

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.sendPlannedFuel();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'fuel', value: 25 }],
      });
      expect(rootStore.pitServiceWidget.isAutoFuelPending).toBe(true);
    });

    it('takes over again on the next pit entry', async () => {
      enableAuto();
      rootStore.pitServiceWidget.suspendAuto();

      rootStore.pitServiceWidget.handlePitRoadChange(true);
      rootStore.pitServiceWidget.handlePitRoadChange(false);

      expect(rootStore.pitServiceWidget.isAutoActive).toBe(true);
    });

    it('sends nothing when the widget is not in the active layout', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 0.1 });
      setSettings({ enabled: false });

      invokeMock.mockClear();

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(rootStore.pitServiceWidget.isAutoEnabled).toBe(false);
      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });

    it('is off entirely when neither fuel nor tires are automatic', async () => {
      enableAuto();
      setSettings({ autoFuel: false, autoTires: false });
      setTireWear({ lf: 0.1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(rootStore.pitServiceWidget.isAutoEnabled).toBe(false);
      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });
  });

  it('clears the whole order with a single command', async () => {
    await rootStore.pitServiceWidget.sendClearOrder();

    expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
      requests: [{ kind: 'clear', value: 0 }],
    });
  });
});

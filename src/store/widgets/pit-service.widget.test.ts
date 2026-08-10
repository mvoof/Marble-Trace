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
          { kind: 'clear', value: 0 },
          { kind: 'fuel', value: 25 },
        ],
      });
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'lf', value: 0 },
          { kind: 'rr', value: 0 },
        ],
      });
    });

    // The whole point of the split: on pit road the sim still reports the
    // previous stop's tread, and only the stall reading may decide the order.
    it('orders tires from the wear read in the stall, not on pit entry', async () => {
      setFuelPlan(24.1, 106);
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      expect(invokeMock).not.toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'lf', value: 0 }],
      });

      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'lf', value: 0 }],
      });
    });

    it('sends nothing for tires when no corner is worn enough', async () => {
      enableAuto();
      setTireWear({ lf: 1, rf: 1, lr: 1, rr: 1 });

      await rootStore.pitServiceWidget.applyAutoFuelOrder();

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).not.toHaveBeenCalledWith(
        'send_pit_order',
        expect.anything()
      );
    });

    // A missed pit road flag skips the fuel half, and with it the start-of-stop
    // clear the tire half assumes has already gone out.
    it('carries the clear itself when the fuel half never went out', async () => {
      enableAuto();
      setTireWear({ lf: 0.3, rf: 1, lr: 1, rr: 1 });

      invokeMock.mockClear();
      await rootStore.pitServiceWidget.applyAutoTireOrder();

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [
          { kind: 'clear', value: 0 },
          { kind: 'lf', value: 0 },
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
          { kind: 'clear', value: 0 },
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

      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'clear', value: 0 }],
      });
      expect(invokeMock).toHaveBeenCalledWith('send_pit_order', {
        requests: [{ kind: 'lf', value: 0 }],
      });
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
